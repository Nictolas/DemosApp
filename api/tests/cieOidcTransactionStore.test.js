const test = require('node:test');
const assert = require('node:assert/strict');

const {
  saveCieOidcTransaction,
  consumeCieOidcTransaction
} = require('../services/cieOidcTransactionStore');

function fakeRedis() {
  const data = new Map();
  return {
    async set(key, value) { data.set(key, value); },
    async get(key) { return data.has(key) ? data.get(key) : null; },
    async del(key) { data.delete(key); }
  };
}

test('salva e consuma una transazione CIE reale senza persistere CF', async () => {
  const redis = fakeRedis();
  const tx = {
    state: 'a'.repeat(64),
    nonce: 'b'.repeat(64),
    codeVerifier: 'verifier-value',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-1', tx, redis);
  const result = await consumeCieOidcTransaction(tx.state, redis);

  assert.equal(result.userId, 'user-1');
  assert.equal(result.nonce, tx.nonce);
  assert.equal(result.codeVerifier, tx.codeVerifier);
  assert.equal(Object.hasOwn(result, 'fiscal_number'), false);
});

test('la transazione CIE reale e one-time', async () => {
  const redis = fakeRedis();
  const tx = {
    state: 'c'.repeat(64),
    nonce: 'd'.repeat(64),
    codeVerifier: 'verifier-value',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-1', tx, redis);
  await consumeCieOidcTransaction(tx.state, redis);

  await assert.rejects(
    consumeCieOidcTransaction(tx.state, redis),
    /non trovata, scaduta o gia utilizzata/
  );
});
