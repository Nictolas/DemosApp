'use strict';
// Full HTTP flow with real auth/refresh/logout modules and signatures, but an
// in-memory PG/Redis fixture. Never connects to Render, Supabase or real B2.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

function load(relativePath, dependencies, extra = {}) {
  const src = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
  const sandbox = {
    module: { exports: {} }, exports: {},
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error('Unexpected dependency: ' + name);
      return dependencies[name];
    },
    console: { log() {}, warn() {}, error() {} },
    process: { env: {} }, Buffer, setTimeout, clearTimeout, Date,
    ...extra,
  };
  vm.runInNewContext(src, sandbox, { filename: relativePath });
  return sandbox.module.exports;
}

function createSyntheticBackend() {
  const secret = crypto.randomBytes(48).toString('base64url');
  const refreshSecret = crypto.randomBytes(48).toString('base64url');
  const jwtService = load('utils/jwt.js', {
    jsonwebtoken: jwt, crypto,
  }, { process: { env: { JWT_SECRET: secret, JWT_REFRESH_SECRET: refreshSecret, NODE_ENV: 'production' } } });

  const users = new Map([
    ['synthetic-A', { id: 'synthetic-A', email: null, ruolo: 'U', status: 'a' }],
    ['synthetic-B', { id: 'synthetic-B', email: null, ruolo: 'U', status: 'a' }],
  ]);
  const sessions = new Map();
  const writes = [];
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM users')) return { rows: users.has(params[0]) ? [users.get(params[0])] : [] };
      throw new Error('Unexpected pool query');
    },
    async connect() {
      return {
        async query(sql, p = []) {
          const statement = sql.replace(/\s+/g, ' ').trim();
          writes.push(statement.split(' ')[0]);
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rows: [] };
          if (statement.startsWith('SELECT id, user_id, session_token')) {
            const s = sessions.get(p[0]);
            return { rows: s ? [{ ...s }] : [] };
          }
          if (statement.startsWith('UPDATE active_sessions SET is_active = FALSE')) {
            const s = sessions.get(p[0]);
            if (s && s.user_id === p[1]) {
              s.is_active = false;
              return { rows: statement.includes('RETURNING id') ? [{ id: s.id }] : [] };
            }
            return { rows: [] };
          }
          if (statement.startsWith('INSERT INTO active_sessions')) {
            if (sessions.has(p[0])) return { rows: [] };
            const s = {
              id: p[0], user_id: p[1], session_token: p[2],
              is_active: statement.includes('TRUE, $6'), expires_at: p[5],
            };
            sessions.set(s.id, s);
            return { rows: statement.includes('RETURNING id') ? [{ ...s }] : [] };
          }
          if (statement.startsWith('UPDATE active_sessions SET session_token')) {
            const s = sessions.get(p[4]);
            assert.ok(s);
            s.session_token = p[0];
            s.is_active = true;
            s.expires_at = p[3];
            return { rows: [] };
          }
          throw new Error('Unexpected synthetic SQL operation');
        },
        release() {},
      };
    },
  };

  const cache = new Map();
  const redis = {
    async get(key) { return cache.get(key) || null; },
    async set(key, value) { cache.set(key, value); return 'OK'; },
  };
  const cacheKeys = require('../config/cacheKeys');
  const redisCache = { getClient: () => redis };
  const revocationService = load('services/accessRevocationService.js', {
    './redisCache': redisCache, '../config/cacheKeys': cacheKeys,
  });
  const sessionService = load('services/sessionService.js', {
    crypto, jsonwebtoken: jwt, '../config/database': { getPool: () => pool },
  });

  const logger = {
    logRequest: async () => {}, logError: async () => {},
    logPerformance: async () => {}, logAudit: async () => {}, logSecurity: async () => {},
  };
  const logging = load('middleware/loggingMiddleware.js', {
    '../services/centralizedLogger': logger,
    '../services/requestMetrics': { record() {} },
    crypto,
    '../utils/jwt': jwtService,
    '../services/accessRevocationService': revocationService,
  });
  const logoutRouter = load('routes/auth/logout.js', {
    express, '../../utils/jwt': jwtService,
    '../../services/sessionService': sessionService,
    '../../services/accessRevocationService': revocationService,
  });
  const refreshRouter = load('routes/auth/refresh.js', {
    express, '../../utils/jwt': jwtService,
    '../../middleware/rateLimiting': { authLimiter: (_req, _res, next) => next() },
    '../../config/database': { getPool: () => pool },
    '../../services/sessionService': sessionService,
  });
  const app = express();
  app.use(express.json());
  app.use(logging.requestLoggingMiddleware);
  app.use('/api/auth', logoutRouter);
  app.use('/api/auth', refreshRouter);
  app.get('/api/protected', (_req, res) => res.status(200).json({ ok: true }));
  app.use((error, _req, res, _next) => res.status(500).json({ success: false, error: 'synthetic internal error' }));

  function pair(id) {
    const sessionId = 'session-' + id;
    const tokens = jwtService.generateTokenPair({ userId: id, role: 'U', sid: sessionId });
    sessions.set(sessionId, {
      id: sessionId, user_id: id,
      session_token: crypto.createHash('sha256').update(tokens.refreshToken).digest('hex'),
      is_active: true, expires_at: new Date(Date.now() + 86_400_000),
    });
    return { ...tokens, sessionId };
  }
  return { app, pair, sessions, cache, writes, jwtService };
}

async function withServer(app, callback) {
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  try {
    const origin = 'http://127.0.0.1:' + server.address().port;
    await callback({
      async getProtected(token) {
        const r = await fetch(origin + '/api/protected', {
          headers: token ? { authorization: 'Bearer ' + token } : {},
        });
        return r.status;
      },
      async logout(tokens) {
        const r = await fetch(origin + '/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(tokens.accessToken ? { authorization: 'Bearer ' + tokens.accessToken } : {}) },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        return { status: r.status, body: await r.json() };
      },
      async refresh(token) {
        const r = await fetch(origin + '/api/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
        });
        return { status: r.status, body: await r.json() };
      },
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('ephemeral HTTP: A logout denies old access and refresh; independent session B stays valid', async () => {
  const state = createSyntheticBackend();
  const A = state.pair('synthetic-A');
  const B = state.pair('synthetic-B');
  await withServer(state.app, async client => {
    assert.equal(await client.getProtected(A.accessToken), 200);
    assert.equal(await client.getProtected(B.accessToken), 200);
    const logout = await client.logout(A);
    assert.equal(logout.status, 200);
    assert.equal(logout.body.success, true);
    assert.equal(state.sessions.get(A.sessionId).is_active, false);
    assert.equal(state.sessions.get(B.sessionId).is_active, true);
    assert.equal(await client.getProtected(A.accessToken), 401);
    assert.equal((await client.refresh(A.refreshToken)).status, 401);
    assert.equal(await client.getProtected(B.accessToken), 200);
    const refreshB = await client.refresh(B.refreshToken);
    assert.equal(refreshB.status, 200);
    assert.equal(refreshB.body.success, true);
    assert.equal(await client.getProtected(refreshB.body.accessToken), 200);
    assert.equal((await client.refresh(B.refreshToken)).status, 401, 'rotated B refresh is single use');
  });
});

test('ephemeral HTTP: no credential is not a confirmed server logout', async () => {
  const state = createSyntheticBackend();
  await withServer(state.app, async client => {
    const logout = await client.logout({ accessToken: null, refreshToken: null });
    assert.equal(logout.status, 401);
    assert.equal(logout.body.success, false);
  });
});

test('ephemeral HTTP: another session is not affected when access revocation store fails', async () => {
  const state = createSyntheticBackend();
  const A = state.pair('synthetic-A');
  const B = state.pair('synthetic-B');
  // The set method models an unavailable revocation store. No real Redis.
  const original = state.cache.set;
  state.cache.set = () => { throw new Error('synthetic unavailable Redis'); };
  try {
    await withServer(state.app, async client => {
      const logout = await client.logout(A);
      assert.equal(logout.status, 503);
      assert.equal(logout.body.success, false);
      assert.equal(await client.getProtected(B.accessToken), 200);
      assert.equal(state.sessions.get(B.sessionId).is_active, true);
    });
  } finally {
    state.cache.set = original;
  }
});
