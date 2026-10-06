const test = require('node:test');
const assert = require('node:assert/strict');
const { consumeReplayToken } = require('../services/researchRevocationReplayStoreContract');

test('contract forwards only opaque token and bounded TTL', async () => {
  const calls = [];
  const store = { consumeOnce: async (input) => { calls.push(input); return true; } };
  assert.equal(await consumeReplayToken(store, { token: 'x'.repeat(43), ttlSeconds: 3600 }), true);
  assert.deepEqual(calls, [{ token: 'x'.repeat(43), ttlSeconds: 3600 }]);
});

test('contract fails closed on invalid store, token, TTL or result', async () => {
  await assert.rejects(() => consumeReplayToken({}, { token: 'x'.repeat(43), ttlSeconds: 3600 }));
  await assert.rejects(() => consumeReplayToken({ consumeOnce: async () => true }, { token: 'short', ttlSeconds: 3600 }));
  await assert.rejects(() => consumeReplayToken({ consumeOnce: async () => true }, { token: 'x'.repeat(43), ttlSeconds: 59 }));
  await assert.rejects(() => consumeReplayToken({ consumeOnce: async () => true }, { token: 'x'.repeat(43), ttlSeconds: 86401 }));
  await assert.rejects(() => consumeReplayToken({ consumeOnce: async () => 'yes' }, { token: 'x'.repeat(43), ttlSeconds: 3600 }));
});
