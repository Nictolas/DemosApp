const assert = require('node:assert/strict');

async function checkConcurrentConsume(store, token) {
  const input = { token, ttlSeconds: 60 };
  const results = await Promise.all(
    Array.from({ length: 16 }, () => store.consumeOnce(input))
  );
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.filter((value) => value === false).length, 15);
}

async function checkExpiry(store, token, advanceTime) {
  const input = { token, ttlSeconds: 60 };
  assert.equal(await store.consumeOnce(input), true);
  assert.equal(await store.consumeOnce(input), false);
  await advanceTime(60000);
  assert.equal(await store.consumeOnce(input), true);
}

async function checkUnavailableStore(store, token) {
  await assert.rejects(() => store.consumeOnce({ token, ttlSeconds: 60 }));
}

module.exports = { checkConcurrentConsume, checkExpiry, checkUnavailableStore };
