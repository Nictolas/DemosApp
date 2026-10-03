function assertReplayStore(store) {
  if (!store || typeof store.consumeOnce !== 'function') {
    throw new Error('Replay store must provide consumeOnce');
  }
  return store;
}

async function consumeReplayToken(store, { token, ttlSeconds }) {
  assertReplayStore(store);
  if (typeof token !== 'string' || token.length < 32) throw new Error('Opaque replay token required');
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) {
    throw new Error('Replay TTL outside allowed bounds');
  }
  const consumed = await store.consumeOnce({ token, ttlSeconds });
  if (typeof consumed !== 'boolean') throw new Error('Replay store returned invalid result');
  return consumed;
}

module.exports = { assertReplayStore, consumeReplayToken };
