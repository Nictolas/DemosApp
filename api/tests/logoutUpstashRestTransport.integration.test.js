'use strict';
/**
 * The exact production @upstash/redis SDK and redisCache module against
 * a loopback-only REST adapter backed by a disposable real Redis 7 container.
 * This validates wire serialization and expiry, NOT Upstash's hosted service.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const http = require('node:http');
const RedisTcp = require('ioredis');
const { Redis: UpstashRedis } = require('@upstash/redis');
const cacheKeys = require('../config/cacheKeys');

const redisUrl = process.env.DEMOS_LOGOUT_CI_REDIS_URL;
assert.equal(process.env.CI, 'true', 'Only run in isolated CI');
assert.equal(process.env.DEMOS_DISPOSABLE_LOGOUT_STORES, 'true');
const destination = new URL(redisUrl || '');
assert.equal(destination.protocol, 'redis:');
assert.equal(destination.hostname, '127.0.0.1');
assert.equal(destination.port, '6379');

function loadModule(file, deps, env = {}) {
  const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const sandbox = {
    module: { exports: {} }, exports: {},
    require(specifier) {
      assert.ok(Object.hasOwn(deps, specifier), 'unexpected dependency ' + specifier);
      return deps[specifier];
    },
    console: { log() {}, warn() {}, error() {} },
    process: { env }, Date, Map, setTimeout, clearTimeout,
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

test('real Redis via production Upstash REST SDK: revoke, TTL and failure semantics', { timeout: 25000 }, async () => {
  const tcp = new RedisTcp(redisUrl, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  const allowedPrefix = cacheKeys.keys.revokedAccessSession('ci-rest-');
  const observed = [];
  let rejectWrites = false;
  let gateway;
  let sessionId = null;
  try {
    await tcp.connect();
    const gatewayServer = http.createServer(async (req, res) => {
      function reply(status, data) {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(data));
      }
      const endpoint = (req.url || '').split('?')[0];
      if (req.method !== 'POST' || !['/', '/pipeline'].includes(endpoint) ||
          req.headers.authorization !== 'Bearer synthetic-local-only') {
        return reply(403, { error: 'Unauthorized local fixture' });
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) return reply(413, { error: 'Too large' });
      }
      let payload;
      try { payload = JSON.parse(body); } catch { return reply(400, { error: 'Invalid command' }); }
      // @upstash/redis may automatically pipeline even a single GET. Both forms
      // follow its REST wire protocol and are restricted to synthetic keys.
      const commands = endpoint === '/pipeline' ? payload : [payload];
      if (!Array.isArray(commands) || commands.length < 1 || commands.length > 4 ||
          commands.some(command => !Array.isArray(command) || command.length < 2 || command.length > 6)) {
        return reply(400, { error: 'Bad command shape' });
      }
      const results = [];
      for (const command of commands) {
        const cmd = String(command[0]).toUpperCase();
        const key = String(command[1]);
        if (!['GET', 'SET'].includes(cmd) || !key.startsWith(allowedPrefix)) {
          return reply(403, { error: 'Command outside CI namespace' });
        }
        observed.push(cmd);
        if (cmd === 'SET' && rejectWrites) return reply(503, { error: 'synthetic Redis transport failure' });
        try {
          const result = await tcp.call(cmd, ...command.slice(1).map(String));
          results.push({ result });
        } catch (_) {
          return reply(503, { error: 'synthetic Redis gateway failure' });
        }
      }
      return reply(200, endpoint === '/pipeline' ? results : results[0]);
    });
    gateway = await new Promise((resolve, reject) => {
      const listener = gatewayServer.listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    const url = 'http://127.0.0.1:' + gateway.address().port;
    // Load real app redisCache to exercise its SDK client construction.
    const cache = loadModule('services/redisCache.js', {
      '@upstash/redis': { Redis: UpstashRedis },
      '../config/cacheKeys': cacheKeys,
    }, {
      UPSTASH_REDIS_REST_URL: url,
      UPSTASH_REDIS_REST_TOKEN: 'synthetic-local-only',
      UPSTASH_DISABLE_TELEMETRY: '1',
    });
    const service = loadModule('services/accessRevocationService.js', {
      './redisCache': cache,
      '../config/cacheKeys': cacheKeys,
    });

    sessionId = 'ci-rest-' + crypto.randomUUID();
    const decoded = { sid: sessionId, exp: Math.floor(Date.now() / 1000) + 180 };
    const other = { sid: 'ci-rest-other-' + crypto.randomUUID() };
    assert.equal(await service.isAccessSessionRevoked(decoded), false);
    assert.equal(await service.revokeDecodedAccessToken(decoded), true);
    assert.equal(await service.isAccessSessionRevoked(decoded), true);
    assert.equal(await service.isAccessSessionRevoked(other), false);
    const actualTtl = await tcp.ttl(cacheKeys.keys.revokedAccessSession(sessionId));
    assert.ok(actualTtl > 0 && actualTtl <= 180, 'TTL must be retained by real Redis');
    assert.ok(observed.includes('SET') && observed.includes('GET'));

    rejectWrites = true;
    await assert.rejects(
      () => service.revokeDecodedAccessToken({ sid: 'ci-rest-failure-' + crypto.randomUUID() }),
      e => e && e.code === 'ACCESS_REVOCATION_STORE_UNAVAILABLE'
    );
    console.log('PASS actual Upstash REST SDK via local HTTP-to-Redis fixture: get, set, expiry, outage');
  } finally {
    if (tcp.status === 'ready' && sessionId) {
      await tcp.del(cacheKeys.keys.revokedAccessSession(sessionId)).catch(() => {});
    }
    if (gateway) await new Promise(resolve => gateway.close(resolve));
    tcp.disconnect();
  }
});
