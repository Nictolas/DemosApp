'use strict';
/**
 * CI-only integration against isolated real PostgreSQL and Redis services.
 * Real DEMOS route, session, JWT and revocation implementations are loaded with
 * their DB/Redis clients injected; no Supabase/Render/Upstash credentials or
 * external services are consulted. The database fixture is disposable.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Redis = require('ioredis');

const pgUrl = process.env.DEMOS_LOGOUT_CI_POSTGRES_URL;
const redisUrl = process.env.DEMOS_LOGOUT_CI_REDIS_URL;
function failClosed() {
  assert.equal(process.env.CI, 'true', 'This test is restricted to CI');
  assert.equal(process.env.DEMOS_DISPOSABLE_LOGOUT_STORES, 'true');
  assert.ok(pgUrl, 'Missing ephemeral PG URL');
  const pg = new URL(pgUrl);
  const redis = new URL(redisUrl || '');
  assert.equal(pg.protocol, 'postgresql:');
  assert.equal(pg.hostname, '127.0.0.1');
  assert.equal(pg.pathname, '/demos_logout_ci');
  assert.equal(pg.username, 'demos_ci');
  assert.equal(redis.protocol, 'redis:');
  assert.equal(redis.hostname, '127.0.0.1');
  assert.equal(redis.port, '6379');
}
failClosed();

function realModule(file, deps, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const sandbox = {
    module: { exports: {} }, exports: {},
    require(name) {
      assert.ok(Object.hasOwn(deps, name), 'Unexpected dependency: ' + name);
      return deps[name];
    },
    console: { log() {}, warn() {}, error() {} },
    process: { env: {} }, Buffer, Date, Map, URL, setTimeout, clearTimeout,
    ...extra,
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

const userIds = ['ci-person-A', 'ci-person-B'];
const logger = {
  logRequest: async () => {}, logError: async () => {},
  logPerformance: async () => {}, logAudit: async () => {}, logSecurity: async () => {},
};
const cacheKeys = require('../config/cacheKeys');

test('real disposable PostgreSQL + Redis: logout A invalidates access and refresh while B remains active', { timeout: 55000 }, async () => {
  const pool = new Pool({ connectionString: pgUrl, ssl: false, max: 5, connectionTimeoutMillis: 5000 });
  const redis = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 5000 });
  const sessionIds = [];
  let server;
  try {
    await redis.connect();
    await Promise.all([pool.query('SELECT 1'), redis.ping()]);
    await pool.query(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT, ruolo TEXT, nome TEXT, cognome TEXT, status TEXT NOT NULL
    )`);
    await pool.query(`CREATE TABLE active_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_token TEXT NOT NULL,
      ip_address TEXT, user_agent TEXT, login_time TIMESTAMPTZ,
      last_activity TIMESTAMPTZ, is_active BOOLEAN NOT NULL,
      expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ
    )`);
    await pool.query('INSERT INTO users (id, ruolo, status) VALUES ($1,$2,$3), ($4,$5,$6)', [
      userIds[0], 'U', 'a', userIds[1], 'U', 'a',
    ]);
    const jwtService = realModule('utils/jwt.js', { jsonwebtoken: jwt, crypto }, {
      process: { env: {
        NODE_ENV: 'production',
        JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
        JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('base64url'),
      } },
    });
    // The production code uses Upstash's set(key,value,{ex}). Translate only
    // that transport convention to a real, local Redis server.
    const redisAdapter = {
      async get(key) { return redis.get(key); },
      async set(key, value, options) {
        return redis.set(key, value, 'EX', options.ex);
      },
    };
    const revocations = realModule('services/accessRevocationService.js', {
      './redisCache': { getClient: () => redisAdapter },
      '../config/cacheKeys': cacheKeys,
    });
    const sessions = realModule('services/sessionService.js', {
      crypto, jsonwebtoken: jwt,
      '../config/database': { getPool: () => pool },
    });
    const logging = realModule('middleware/loggingMiddleware.js', {
      '../services/centralizedLogger': logger,
      '../services/requestMetrics': { record() {} },
      crypto, '../utils/jwt': jwtService,
      '../services/accessRevocationService': revocations,
    });
    const logout = realModule('routes/auth/logout.js', {
      express, '../../utils/jwt': jwtService,
      '../../services/sessionService': sessions,
      '../../services/accessRevocationService': revocations,
    });
    const refresh = realModule('routes/auth/refresh.js', {
      express, '../../utils/jwt': jwtService,
      '../../middleware/rateLimiting': { authLimiter: (_req, _res, next) => next() },
      '../../config/database': { getPool: () => pool },
      '../../services/sessionService': sessions,
    });
    const app = express();
    app.use(express.json());
    app.use(logging.requestLoggingMiddleware);
    app.use('/api/auth', logout);
    app.use('/api/auth', refresh);
    app.get('/api/protected', (_req, res) => res.json({ ok: true }));
    app.use((_err, _req, res, _next) => res.status(500).json({ success: false }));
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    function pair(id, device) {
      return jwtService.generateTokenPair({ userId: id, role: 'U', sid: device });
    }
    async function register(id, device) {
      const p = pair(id, device);
      sessionIds.push(device);
      const hash = crypto.createHash('sha256').update(p.refreshToken).digest('hex');
      await pool.query(
        `INSERT INTO active_sessions (id,user_id,session_token,login_time,last_activity,is_active,expires_at,created_at)
        VALUES ($1,$2,$3,NOW(),NOW(),TRUE,NOW() + INTERVAL '7 days',NOW())`,
        [device, id, hash],
      );
      return p;
    }
    const a = await register(userIds[0], 'ci-A-phone-' + crypto.randomUUID());
    const aOther = await register(userIds[0], 'ci-A-second-device-' + crypto.randomUUID());
    const b = await register(userIds[1], 'ci-B-' + crypto.randomUUID());
    async function protectedStatus(token) {
      const result = await fetch(base + '/api/protected', {
        headers: { Authorization: 'Bearer ' + token },
      });
      return result.status;
    }
    async function refreshRequest(token) {
      const result = await fetch(base + '/api/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      return { status: result.status, body: await result.json() };
    }
    assert.equal(await protectedStatus(a.accessToken), 200);
    assert.equal(await protectedStatus(aOther.accessToken), 200);
    assert.equal(await protectedStatus(b.accessToken), 200);

    const logoutResponse = await fetch(base + '/api/auth/logout', {
      method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: 'Bearer ' + a.accessToken,
      },
      body: JSON.stringify({ refreshToken: a.refreshToken }),
    });
    assert.equal(logoutResponse.status, 200);
    assert.equal((await logoutResponse.json()).success, true);
    const sessionA = jwtService.verifyRefreshToken(a.refreshToken).sid;
    const sessionA2 = jwtService.verifyRefreshToken(aOther.refreshToken).sid;
    const sessionB = jwtService.verifyRefreshToken(b.refreshToken).sid;
    const status = await pool.query(
      'SELECT id, is_active FROM active_sessions WHERE id = ANY($1)',
      [[sessionA, sessionA2, sessionB]],
    );
    const byId = Object.fromEntries(status.rows.map(x => [x.id, x.is_active]));
    assert.equal(byId[sessionA], false);
    assert.equal(byId[sessionA2], true);
    assert.equal(byId[sessionB], true);
    assert.equal(await redis.get(cacheKeys.keys.revokedAccessSession(sessionA)), '1');
    assert.equal(await redis.get(cacheKeys.keys.revokedAccessSession(sessionA2)), null);
    assert.equal(await redis.get(cacheKeys.keys.revokedAccessSession(sessionB)), null);
    assert.equal(await protectedStatus(a.accessToken), 401);
    assert.equal((await refreshRequest(a.refreshToken)).status, 401);
    assert.equal(await protectedStatus(aOther.accessToken), 200);
    assert.equal(await protectedStatus(b.accessToken), 200);
    const aOtherRefresh = await refreshRequest(aOther.refreshToken);
    assert.equal(aOtherRefresh.status, 200);
    assert.equal(await protectedStatus(aOtherRefresh.body.accessToken), 200);
    const bRefresh = await refreshRequest(b.refreshToken);
    assert.equal(bRefresh.status, 200);
    assert.equal(await protectedStatus(bRefresh.body.accessToken), 200);
    assert.equal((await refreshRequest(b.refreshToken)).status, 401);

    const emptyLogout = await fetch(base + '/api/auth/logout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: null }),
    });
    assert.equal(emptyLogout.status, 401);
    assert.equal((await emptyLogout.json()).success, false);
    console.log('PASS isolated PostgreSQL 16 + Redis 7: A revoked access/refresh, A other device and B unaffected');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    // The service containers and test database are disposable, but remove
    // per-session keys explicitly to avoid misleading future CI reruns.
    if (redis.status === 'ready') {
      for (const id of sessionIds) {
        await redis.del(cacheKeys.keys.revokedAccessSession(id)).catch(() => {});
      }
    }
    await pool.end();
    redis.disconnect();
  }
});
