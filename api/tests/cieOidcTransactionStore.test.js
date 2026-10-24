const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  saveCieOidcTransaction,
  saveCieRecognitionTransaction,
  saveCieRegistrationTransaction,
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

      if (!args || args.length === 0) {
        const value = data.has(key) ? data.get(key) : null;
        if (value != null) data.delete(key);
        return value;
      }

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


test('libera il lock anche se il payload Redis della transazione e corrotto', async () => {
  const redis = fakeRedis();
  const tx = {
    state: '2'.repeat(64),
    nonce: '3'.repeat(64),
    codeVerifier: 'verifier-corrupt',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-corrupt', tx, redis);

  const txKey = `cie:oidc:tx:${sha256(tx.state)}`;
  redis.data.set(txKey, '{json-corrotto');

  await assert.rejects(
    consumeCieOidcTransaction(tx.state, redis),
    SyntaxError
  );

  const nextTx = {
    state: '4'.repeat(64),
    nonce: '5'.repeat(64),
    codeVerifier: 'verifier-next',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-corrupt', nextTx, redis);
  assert.equal((await consumeCieOidcTransaction(nextTx.state, redis)).userId, 'user-corrupt');
});

test('resta compatibile con transazioni create senza chiave owner', async () => {
  const redis = fakeRedis();
  const state = '6'.repeat(64);
  const userId = 'user-legacy';
  const txKey = `cie:oidc:tx:${sha256(state)}`;
  const lockKey = `cie:oidc:user:${sha256(userId)}`;

  redis.data.set(txKey, JSON.stringify({
    userId,
    state,
    nonce: '7'.repeat(64),
    codeVerifier: 'legacy-verifier',
    expiresAt: Date.now() + 60000
  }));
  redis.data.set(lockKey, sha256(state));

  const result = await consumeCieOidcTransaction(state, redis);
  assert.equal(result.userId, userId);
  assert.equal(redis.data.has(lockKey), false);
});


test('fallback senza GETDEL consuma atomicamente la transazione tramite EVAL', async () => {
  const redis = fakeRedis();
  const tx = {
    state: '8'.repeat(64),
    nonce: '9'.repeat(64),
    codeVerifier: 'verifier-fallback',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-fallback', tx, redis);
  const result = await consumeCieOidcTransaction(tx.state, redis);

  assert.equal(result.userId, 'user-fallback');

  await assert.rejects(
    consumeCieOidcTransaction(tx.state, redis),
    /non trovata, scaduta o gia utilizzata/
  );
});

test('rifiuta consumo se Redis non supporta ne GETDEL ne EVAL', async () => {
  const redis = fakeRedis();
  const tx = {
    state: 'a'.repeat(63) + 'b',
    nonce: 'b'.repeat(64),
    codeVerifier: 'verifier-no-atomic',
    expiresAt: Date.now() + 60000
  };

  await saveCieOidcTransaction('user-no-atomic', tx, redis);

  delete redis.eval;

  await assert.rejects(
    consumeCieOidcTransaction(tx.state, redis),
    /GETDEL o EVAL richiesto/
  );
});


test('salva registrazione CIE pre-account senza userId e senza fiscal_number', async () => {
  const redis = fakeRedis();
  const tx = {
    state: 'f'.repeat(64),
    nonce: 'e'.repeat(64),
    codeVerifier: 'registration-verifier',
    expiresAt: Date.now() + 60000
  };
  const registration = {
    provider: 'google',
    providerSub: 'google-sub-new',
    privacyPolicyConsent: true,
    termsOfServiceConsent: true
  };

  await saveCieRegistrationTransaction('google:google-sub-new', registration, tx, redis);
  const result = await consumeCieOidcTransaction(tx.state, redis);

  assert.equal(result.flow, 'registration');
  assert.deepEqual(result.registration, registration);
  assert.equal(Object.hasOwn(result, 'userId'), false);
  assert.equal(JSON.stringify(result).includes('fiscal_number'), false);
});

test('recognition CIE transaction is one-time and purpose-bound', async () => {
  const redis = fakeRedis();
  const tx = {
    state: 'z'.repeat(64), nonce: 'y'.repeat(64),
    codeVerifier: 'one-time', expiresAt: Date.now() + 60000
  };
  await saveCieRecognitionTransaction('user-public', tx, redis);
  const consumed = await consumeCieOidcTransaction(tx.state, redis);
  assert.equal(consumed.flow, 'recognition');
  assert.equal(consumed.userId, 'user-public');
  assert.equal(JSON.stringify(consumed).includes('givenName'), false);
  await assert.rejects(consumeCieOidcTransaction(tx.state, redis), /non trovata/);
});

test('pre-account CIE transactions strip citizen personal names', async () => {
  const redis = fakeRedis();
  const tx = {
    state: 'q'.repeat(64), nonce: 'w'.repeat(64),
    codeVerifier: 'verifier', expiresAt: Date.now() + 60000
  };
  await saveCieRegistrationTransaction('oauth:sub', {
    provider: 'google', providerSub: 'some-sub', privacyPolicyConsent: true,
    termsOfServiceConsent: true, givenName: 'Giovanna',
    familyName: 'Bianchi', name: 'Giovanna Bianchi'
  }, tx, redis);
  const loaded = await consumeCieOidcTransaction(tx.state, redis);
  assert.equal(loaded.registration.givenName, undefined);
  assert.equal(loaded.registration.familyName, undefined);
  assert.equal(loaded.registration.name, undefined);
  assert.equal(JSON.stringify(loaded).includes('Giovanna'), false);
});
