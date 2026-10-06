const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createOpaqueRateLimitKey,
  ResearchDistributedRateLimitStore
} = require('../services/researchDistributedRateLimitStore');

test('Research distributed rate-limit keys are HMAC-pseudonymized before backend use', async () => {
  const calls = [];
  const secret = Buffer.alloc(32, 7);
  const store = new ResearchDistributedRateLimitStore({
    keySecret: secret,
    namespace: 'read',
    backend: {
      async increment(input) {
        calls.push(input);
        return { totalHits: 1, resetTime: new Date('2030-01-01T00:00:00.000Z') };
      }
    }
  });

  store.init({ windowMs: 60000 });
  const result = await store.increment('203.0.113.42');

  assert.equal(result.totalHits, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].windowMs, 60000);
  assert.notEqual(calls[0].key, '203.0.113.42');
  assert.equal(calls[0].key.includes('203.0.113.42'), false);
  assert.equal(calls[0].key, createOpaqueRateLimitKey({
    rawKey: '203.0.113.42',
    keySecret: secret,
    namespace: 'read'
  }));
});

test('Research distributed rate-limit namespaces separate challenge and read counters', () => {
  const secret = Buffer.alloc(32, 3);
  const rawKey = '203.0.113.42';
  const challengeKey = createOpaqueRateLimitKey({ rawKey, keySecret: secret, namespace: 'challenge' });
  const readKey = createOpaqueRateLimitKey({ rawKey, keySecret: secret, namespace: 'read' });
  assert.notEqual(challengeKey, readKey);
});

test('Research distributed store requires atomic backend contract and valid result', async () => {
  assert.throws(
    () => new ResearchDistributedRateLimitStore({ backend: {}, keySecret: Buffer.alloc(32, 1) }),
    /backend\.increment is required/
  );

  const store = new ResearchDistributedRateLimitStore({
    keySecret: Buffer.alloc(32, 1),
    backend: { async increment() { return { totalHits: 0, resetTime: 'not-a-date' }; } }
  });
  store.init({ windowMs: 60000 });
  await assert.rejects(() => store.increment('key'), /invalid result/);
});

test('Research distributed store requires a strong secret and never falls back to raw keys', () => {
  assert.throws(
    () => createOpaqueRateLimitKey({ rawKey: 'ip', keySecret: Buffer.alloc(16) }),
    /at least 32 bytes/
  );
  assert.throws(
    () => new ResearchDistributedRateLimitStore({
      backend: { increment() {} },
      keySecret: Buffer.alloc(16)
    }),
    /at least 32 bytes/
  );
});
