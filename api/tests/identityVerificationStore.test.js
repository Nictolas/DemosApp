const test = require('node:test');
const assert = require('node:assert/strict');

process.env.IDENTITY_HMAC_SECRET = 'test-secret-for-demos-identity-key-1234567890';

const {
  IdentityVerificationError,
  getIdentityVerificationStatus,
  registerVerifiedIdentity
} = require('../services/identityVerificationStore');

function createFakeDb(handler) {
  return { query: handler };
}

test('utente senza verifica restituisce verified=false', async () => {
  const db = createFakeDb(async () => ({ rows: [] }));
  assert.deepEqual(await getIdentityVerificationStatus('user-1', db), { verified: false });
});

test('lo stato pubblico espone solo verified e provider', async () => {
  const db = createFakeDb(async sql => {
    assert.match(sql, /SELECT provider, status/);
    assert.doesNotMatch(sql, /person_key/);
    assert.doesNotMatch(sql, /verified_at/);
    assert.match(sql, /WHERE user_id = \$1 AND detached_at IS NULL/);
    assert.doesNotMatch(sql, /retention_until/);

    return {
      rows: [{
        provider: 'CIE',
        status: 'verified'
      }]
    };
  });

  const status = await getIdentityVerificationStatus('user-1', db);
  assert.deepEqual(status, {
    verified: true,
    provider: 'CIE'
  });
  assert.deepEqual(Object.keys(status).sort(), ['provider', 'verified']);
});

test('registra una nuova identita senza restituire person_key', async () => {
  let call = 0;
  const db = createFakeDb(async (sql, params) => {
    call++;
    if (call === 1) return { rows: [] };

    assert.match(sql, /INSERT INTO identity_verifications/);
    assert.equal(params[0], 'user-1');
    assert.match(params[1], /^[a-f0-9]{64}$/);
    assert.equal(params[2], 'CIE');

    return {
      rows: [{
        provider: 'CIE',
        status: 'verified',
        verified_at: '2026-09-20T00:00:00Z',
        detached_at: null,
        retention_until: null
      }]
    };
  });

  const result = await registerVerifiedIdentity({
    userId: 'user-1',
    fiscalNumber: 'TINIT-ABCDEF12G34H567I'
  }, db);

  assert.equal(result.created, true);
  assert.equal(result.verified, true);
  assert.equal(Object.hasOwn(result, 'person_key'), false);
});

test('stessa identita sullo stesso account e idempotente', async () => {
  const expectedKey = require('../services/identityVerificationService')
    .derivePersonKey('ABCDEF12G34H567I');

  const db = createFakeDb(async () => ({
    rows: [{
      person_key: expectedKey,
      provider: 'CIE',
      status: 'verified',
      verified_at: '2026-09-20T00:00:00Z',
      detached_at: null,
      retention_until: null
    }]
  }));

  const result = await registerVerifiedIdentity({
    userId: 'user-1',
    fiscalNumber: 'ABCDEF12G34H567I'
  }, db);

  assert.equal(result.created, false);
  assert.equal(result.verified, true);
});


test('una collisione sulla person_key non abortisce la transazione e segnala il conflitto', async () => {
  let call = 0;
  const db = createFakeDb(async (sql, params) => {
    call++;
    if (call === 1) return { rows: [] }; // no user identity
    if (call === 2) {
      assert.match(sql, /ON CONFLICT DO NOTHING/);
      return { rows: [] }; // concurrent insert won
    }
    if (call === 3) return { rows: [] }; // no user identity after conflict
    assert.equal(call, 4);
    assert.match(sql, /WHERE person_key = \$1/);
    assert.match(params[0], /^[a-f0-9]{64}$/);
    return { rows: [{ '?column?': 1 }] }; // same identity already linked elsewhere
  });

  await assert.rejects(
    registerVerifiedIdentity({
      userId: 'user-2',
      fiscalNumber: 'ABCDEF12G34H567I'
    }, db),
    error => error instanceof IdentityVerificationError && error.code === 'PERSON_ALREADY_LINKED'
  );
  assert.equal(call, 4);
});

test('la finalizzazione concorrente dello stesso account resta idempotente', async () => {
  const key = require('../services/identityVerificationService')
    .derivePersonKey('ABCDEF12G34H567I');
  let call = 0;
  const db = createFakeDb(async (sql) => {
    call++;
    if (call === 1) return { rows: [] };
    if (call === 2) {
      assert.match(sql, /ON CONFLICT DO NOTHING/);
      return { rows: [] };
    }
    assert.equal(call, 3);
    return { rows: [{
      person_key: key,
      provider: 'CIE',
      status: 'verified',
      detached_at: null,
      verified_at: '2026-10-29T00:00:00Z',
      retention_until: null
    }] };
  });
  const result = await registerVerifiedIdentity({
    userId: 'user-1',
    fiscalNumber: 'ABCDEF12G34H567I'
  }, db);
  assert.equal(result.created, false);
  assert.equal(result.verified, true);
  assert.equal(call, 3);
});
