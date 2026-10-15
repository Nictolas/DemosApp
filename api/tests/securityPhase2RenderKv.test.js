const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSecurityPhase2RenderKvConfig,
  createSecurityPhase2RenderKvClient
} = require('../security-agent/securityPhase2RenderKv');

const id = 'red-db2ljmc9v7es738inuh0';
const safeEnv = overrides => ({
  SECURITY_PHASE2_RENDER_KV_ENABLED: 'true',
  SECURITY_PHASE2_RENDER_KV_ID: id,
  SECURITY_PHASE2_RENDER_KV_URL: `redis://${id}:6379`,
  ...(overrides || {})
});

test('Render KV validation is disabled by default', () => {
  const config = buildSecurityPhase2RenderKvConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.ready, false);
  assert.equal(config.productionWriteAllowed, false);
});

test('exact private Render Redis URL is accepted without exposing the URL', () => {
  const config = buildSecurityPhase2RenderKvConfig(safeEnv());
  assert.equal(config.enabled, true);
  assert.equal(config.ready, true);
  assert.equal(config.renderKvId, id);
  assert.equal(config.privateNetworkOnly, true);
  assert.equal(config.authenticationRequired, false);
  assert.equal(config.productionWriteAllowed, false);
  assert.equal(JSON.stringify(config).includes('redis://'), false);
});

test('unsafe or non-private Render KV URL shapes fail closed', () => {
  const cases = [
    ['rediss protocol', { SECURITY_PHASE2_RENDER_KV_URL: `rediss://${id}:6379` }],
    ['host mismatch', { SECURITY_PHASE2_RENDER_KV_URL: 'redis://red-other123:6379' }],
    ['embedded password', { SECURITY_PHASE2_RENDER_KV_URL: `redis://user:secret@${id}:6379` }],
    ['bad port', { SECURITY_PHASE2_RENDER_KV_URL: `redis://${id}:6380` }],
    ['bad id', { SECURITY_PHASE2_RENDER_KV_ID: 'redis-prod' }]
  ];
  for (const [name, patch] of cases) {
    const config = buildSecurityPhase2RenderKvConfig(safeEnv(patch));
    assert.equal(config.ready, false, name);
    assert.ok(config.blockers.length > 0, name);
  }
});

test('client uses bounded Redis options and supports ping/get/set/del without leaking connection URL', async () => {
  let constructed = null;
  class FakeRedis {
    constructor(url, options) {
      constructed = { url, options };
      this.status = 'wait';
      this.data = new Map();
      this.disconnected = false;
    }
    async connect() { this.status = 'ready'; }
    async ping() { return 'PONG'; }
    async get(key) { return this.data.get(key) ?? null; }
    async set(key, value, mode, ttl) {
      assert.equal(mode, 'EX');
      assert.equal(ttl, 60);
      this.data.set(key, value);
      return 'OK';
    }
    async del(key) { return this.data.delete(key) ? 1 : 0; }
    disconnect() { this.disconnected = true; }
  }

  const client = createSecurityPhase2RenderKvClient({ env: safeEnv(), RedisCtor: FakeRedis });
  assert.equal(await client.connect(), true);
  assert.equal(constructed.url, `redis://${id}:6379`);
  assert.equal(constructed.options.lazyConnect, true);
  assert.equal(constructed.options.enableOfflineQueue, false);
  assert.equal(constructed.options.maxRetriesPerRequest, 0);
  await client.set('key', '1', { ex: 60 });
  assert.equal(await client.get('key'), '1');
  assert.equal(await client.del('key'), 1);
  assert.equal(await client.get('key'), null);
  client.disconnect();
});
