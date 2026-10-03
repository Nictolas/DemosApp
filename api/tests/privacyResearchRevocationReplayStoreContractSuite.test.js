const test = require('node:test');
const { checkConcurrentConsume, checkExpiry, checkUnavailableStore } = require('./helpers/replayStoreContractSuite');
const { createMemoryReplayStore } = require('../services/researchRevocationMemoryStore');

test('memory POC satisfies concurrent consume contract', async () => {
  const store = createMemoryReplayStore();
  await checkConcurrentConsume(store, 'a'.repeat(43));
});

test('memory POC satisfies expiry contract', async () => {
  let time = 0;
  const store = createMemoryReplayStore({ now: () => time });
  await checkExpiry(store, 'b'.repeat(43), async (ms) => { time += ms; });
});

test('contract requires unavailable storage to reject, not accept', async () => {
  const store = { consumeOnce: async () => { throw new Error('unavailable'); } };
  await checkUnavailableStore(store, 'c'.repeat(43));
});
