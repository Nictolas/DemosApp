const test = require('node:test');
const assert = require('node:assert/strict');
const { consumeReplayToken } = require('../services/researchRevocationReplayStoreContract');
const { createMemoryReplayStore } = require('../services/researchRevocationMemoryStore');

test('POC accepts exactly one concurrent consume for the same token', async () => {
  const store = createMemoryReplayStore();
  const input = { token: 't'.repeat(43), ttlSeconds: 60 };
  const results = await Promise.all(Array.from({ length: 16 }, () => consumeReplayToken(store, input)));
  assert.equal(results.filter(Boolean).length, 1);
});

test('POC permits reuse only after TTL expiry', async () => {
  let time = 1000;
  const store = createMemoryReplayStore({ now: () => time });
  const input = { token: 'u'.repeat(43), ttlSeconds: 60 };
  assert.equal(await consumeReplayToken(store, input), true);
  assert.equal(await consumeReplayToken(store, input), false);
  time += 60000;
  assert.equal(await consumeReplayToken(store, input), true);
});

test('expired entries can be swept without identity metadata', async () => {
  let time = 0;
  const store = createMemoryReplayStore({ now: () => time });
  await consumeReplayToken(store, { token: 'v'.repeat(43), ttlSeconds: 60 });
  time = 60000;
  assert.equal(store.sweepExpired(), 0);
});
