const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.USE_MOCK_CIE = 'true';

const {
  TTL_MS,
  startMockTransaction,
  consumeMockTransaction,
  clearMockTransactionsForTests
} = require('../services/cieMockFlowService');

test.afterEach(() => {
  clearMockTransactionsForTests();
});

test('crea transazione mock con state nonce e PKCE', () => {
  const tx = startMockTransaction('user-1', 1000);

  assert.ok(tx.state);
  assert.ok(tx.nonce);
  assert.ok(tx.codeChallenge);
  assert.equal(tx.codeChallengeMethod, 'S256');
  assert.equal(tx.expiresIn, TTL_MS / 1000);
  assert.equal(Object.hasOwn(tx, 'codeVerifier'), false);
});

test('consuma una transazione una sola volta', () => {
  const tx = startMockTransaction('user-1', 1000);

  const consumed = consumeMockTransaction({
    userId: 'user-1',
    state: tx.state,
    nonce: tx.nonce
  }, 1001);

  assert.equal(consumed.userId, 'user-1');
  assert.ok(consumed.codeVerifier);

  assert.throws(
    () => consumeMockTransaction({
      userId: 'user-1',
      state: tx.state,
      nonce: tx.nonce
    }, 1002),
    /non trovata o gia utilizzata/
  );
});

test('rifiuta nonce errato', () => {
  const tx = startMockTransaction('user-1', 1000);

  assert.throws(
    () => consumeMockTransaction({
      userId: 'user-1',
      state: tx.state,
      nonce: 'nonce-errato'
    }, 1001),
    /State o nonce/
  );
});

test('rifiuta transazione di un altro account', () => {
  const tx = startMockTransaction('user-1', 1000);

  assert.throws(
    () => consumeMockTransaction({
      userId: 'user-2',
      state: tx.state,
      nonce: tx.nonce
    }, 1001),
    /non associata/
  );
});

test('rifiuta transazione scaduta', () => {
  const tx = startMockTransaction('user-1', 1000);

  assert.throws(
    () => consumeMockTransaction({
      userId: 'user-1',
      state: tx.state,
      nonce: tx.nonce
    }, 1000 + TTL_MS + 1),
    /scaduta/
  );
});

test('mock CIE resta disabilitato in produzione', () => {
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    assert.throws(
      () => startMockTransaction('user-1'),
      /Mock CIE non disponibile/
    );
  } finally {
    process.env.NODE_ENV = oldNodeEnv;
  }
});
