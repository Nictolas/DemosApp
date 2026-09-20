const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  saveCieOidcTransaction,
  consumeCieOidcTransaction
} = require('../services/cieOidcTransactionStore');

function fakeRedis() {
  const data = new Map();
  return {
    data,
    async set(key, value, options = {}) {
      if (options.nx && data.has(key)) return null;
      data.set(key, value);
      return 'OK';
    },
    async get(key) { return data.has(key) ? data.get(key) : null; },
    async del(key) { data.delete(key); },
    async eval(_script, keys, args) {
      const [key] = keys;
      const [expected] = args;

      if (data.get(key) === expected) {
        data.delete(key);
        return 1;
      }

      return 0;
    }
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
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


test('blocca una seconda transazione CIE contemporanea sullo stesso account', async () => {
  const redis = fakeRedis();
  const tx1 = {
    state: 'e'.repeat(64),
    nonce: 'f'.repeat(64),
    codeVerifier: 'verifier-1',
    expiresAt: Date.now() + 60000
  };
  const tx2 = {
    state: '1'.repeat(64),
    nonce: '2'.repeat(64),
    codeVerifier: 'verifier-2',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-1', tx1, redis);

  await assert.rejects(
    saveCieOidcTransaction('user-1', tx2, redis),
    error => error?.code === 'CIE_TRANSACTION_ALREADY_ACTIVE'
  );
});

test('dopo il consumo permette una nuova transazione per lo stesso account', async () => {
  const redis = fakeRedis();
  const tx1 = {
    state: '3'.repeat(64),
    nonce: '4'.repeat(64),
    codeVerifier: 'verifier-1',
    expiresAt: Date.now() + 60000
  };
  const tx2 = {
    state: '5'.repeat(64),
    nonce: '6'.repeat(64),
    codeVerifier: 'verifier-2',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-1', tx1, redis);
  await consumeCieOidcTransaction(tx1.state, redis);
  await saveCieOidcTransaction('user-1', tx2, redis);

  const result = await consumeCieOidcTransaction(tx2.state, redis);
  assert.equal(result.userId, 'user-1');
});

test('consente transazioni contemporanee a account diversi', async () => {
  const redis = fakeRedis();
  const tx1 = {
    state: '7'.repeat(64),
    nonce: '8'.repeat(64),
    codeVerifier: 'verifier-1',
    expiresAt: Date.now() + 60000
  };
  const tx2 = {
    state: '9'.repeat(64),
    nonce: 'a'.repeat(64),
    codeVerifier: 'verifier-2',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-1', tx1, redis);
  await saveCieOidcTransaction('user-2', tx2, redis);

  assert.equal((await consumeCieOidcTransaction(tx1.state, redis)).userId, 'user-1');
  assert.equal((await consumeCieOidcTransaction(tx2.state, redis)).userId, 'user-2');
});


test('rilascio lock non cancella un lock piu recente dello stesso account', async () => {
  const redis = fakeRedis();
  const tx1 = {
    state: 'b'.repeat(64),
    nonce: 'c'.repeat(64),
    codeVerifier: 'verifier-1',
    expiresAt: Date.now() + 60000
  };
  const newerState = 'd'.repeat(64);

  await saveCieOidcTransaction('user-race', tx1, redis);

  const lockKey = `cie:oidc:user:${sha256('user-race')}`;
  redis.data.set(lockKey, sha256(newerState));

  await consumeCieOidcTransaction(tx1.state, redis);

  assert.equal(redis.data.get(lockKey), sha256(newerState));
});

test('rilascia il lock anche quando la transazione consumata risulta scaduta', async () => {
  const redis = fakeRedis();
  const tx = {
    state: 'e'.repeat(64),
    nonce: 'f'.repeat(64),
    codeVerifier: 'verifier-expired',
    expiresAt: Date.now() - 1
  };

  await saveCieOidcTransaction('user-expired', tx, redis);

  await assert.rejects(
    consumeCieOidcTransaction(tx.state, redis),
    /scaduta/
  );

  const nextTx = {
    state: '0'.repeat(64),
    nonce: '1'.repeat(64),
    codeVerifier: 'verifier-next',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-expired', nextTx, redis);
  assert.equal((await consumeCieOidcTransaction(nextTx.state, redis)).userId, 'user-expired');
});
