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

test('lo stato pubblico non espone person_key', async () => {
  const db = createFakeDb(async () => ({
    rows: [{
      person_key: 'a'.repeat(64),
      provider: 'CIE',
      status: 'verified',
      verified_at: '2026-09-20T00:00:00Z',
      detached_at: null,
      retention_until: null
    }]
  }));

  const status = await getIdentityVerificationStatus('user-1', db);
  assert.equal(status.verified, true);
  assert.equal(status.provider, 'CIE');
  assert.equal(Object.hasOwn(status, 'person_key'), false);
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

test('blocca person_key gia collegata a un altro account', async () => {
  let call = 0;
  const db = createFakeDb(async () => {
    call++;
    if (call === 1) return { rows: [] };
    if (call === 2) {
      const error = new Error('duplicate');
      error.code = '23505';
      error.constraint = 'identity_verifications_person_key_key';
      throw error;
    }
    return { rows: [] };
  });

  await assert.rejects(
    registerVerifiedIdentity({
      userId: 'user-2',
      fiscalNumber: 'ABCDEF12G34H567I'
    }, db),
    error => error instanceof IdentityVerificationError && error.code === 'PERSON_ALREADY_LINKED'
  );
});
