const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.USE_MOCK_CIE = 'true';

const {
  TTL_MS,
  startMockTransaction,
  consumeMockTransaction,
  getMockCieStartErrorResponse,
  getMockCieCompleteErrorResponse,
  clearMockTransactionsForTests
} = require('../services/cieMockFlowService');

test.afterEach(() => {
  clearMockTransactionsForTests();
});

test('espone solo state e nonce nell avvio mock', () => {
  const tx = startMockTransaction('user-1', 1000);

  assert.ok(tx.state);
  assert.ok(tx.nonce);
  assert.deepEqual(Object.keys(tx).sort(), ['nonce', 'state']);
  assert.equal(Object.hasOwn(tx, 'codeVerifier'), false);
  assert.equal(Object.hasOwn(tx, 'codeChallenge'), false);
  assert.equal(Object.hasOwn(tx, 'codeChallengeMethod'), false);
  assert.equal(Object.hasOwn(tx, 'expiresIn'), false);
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


test('non espone errori interni durante avvio mock', () => {
  const result = getMockCieStartErrorResponse(new Error('database-secret-detail'));

  assert.deepEqual(result, {
    status: 400,
    error: 'Impossibile avviare la verifica CIE mock'
  });
  assert.equal(result.error.includes('database-secret-detail'), false);
});

test('espone solo conflitti mock esplicitamente sicuri', () => {
  assert.deepEqual(
    getMockCieCompleteErrorResponse({ code: 'PERSON_ALREADY_LINKED', message: 'internal' }),
    {
      status: 409,
      error: 'Identita gia associata a un altro account DEMOS'
    }
  );

  assert.deepEqual(
    getMockCieCompleteErrorResponse({ code: 'ACCOUNT_ALREADY_VERIFIED', message: 'internal' }),
    {
      status: 409,
      error: 'Account gia associato a una identita verificata'
    }
  );
});

test('nasconde errori interni sconosciuti nel completamento mock', () => {
  const result = getMockCieCompleteErrorResponse({
    code: 'DATABASE_FAILURE',
    message: 'postgres connection string leaked'
  });

  assert.deepEqual(result, {
    status: 400,
    error: 'Verifica CIE mock non riuscita'
  });
  assert.equal(result.error.includes('postgres'), false);
});
