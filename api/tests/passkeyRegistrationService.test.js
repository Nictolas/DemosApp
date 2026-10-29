const test = require('node:test');
const assert = require('node:assert/strict');

process.env.IDENTITY_HMAC_SECRET = 'test-secret-for-demos-identity-key-1234567890';

const { completePasskeyRegistrationAfterCie, completePasskeyRegistrationWithoutCie } = require('../services/passkeyRegistrationService');

function makePool({ duplicatePerson = false } = {}) {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') return { rows: [] };
      if (normalized === 'SELECT id FROM users WHERE id = $1 LIMIT 1') return { rows: [] };
      if (normalized.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };
      if (normalized.includes('FROM users WHERE webauthn_credential_id = ANY')) return { rows: [] };
      if (normalized === 'SELECT id FROM users WHERE webauthn_device_id = $1 LIMIT 1') return { rows: [] };
      if (normalized.startsWith('INSERT INTO users')) return { rows: [] };
      if (normalized.startsWith('INSERT INTO user_profile')) return { rows: [] };
      if (normalized.startsWith('INSERT INTO user_consents')) return { rows: [] };
      if (normalized.startsWith('SELECT person_key, provider, status')) return { rows: [] };
      if (normalized.startsWith('SELECT 1 FROM identity_verifications WHERE person_key')) return { rows: duplicatePerson ? [{ exists: 1 }] : [] };
      if (normalized.startsWith('UPDATE users SET sesso = $1')) return { rowCount: 1 };
      if (normalized.startsWith('INSERT INTO identity_verifications')) {
        if (duplicatePerson) return { rows: [] }; // ON CONFLICT DO NOTHING in real PostgreSQL
        return {
          rows: [{
            provider: 'CIE',
            status: 'verified',
            verified_at: new Date().toISOString(),
            detached_at: null,
            retention_until: null,
          }],
        };
      }
      throw new Error(`Unexpected SQL in test: ${normalized}`);
    },
    release() { calls.push({ sql: 'RELEASE', params: [] }); },
  };

  let connects = 0;
  return {
    calls,
    get connects() { return connects; },
    pool: {
      async connect() {
        connects += 1;
        return client;
      },
    },
  };
}

function registration() {
  return {
    authMethod: 'passkey',
    passkey: {
      registrationKey: 'reg_1234567890abcdef',
      userHandle: 'dXNlci1oYW5kbGU',
      credentialId: 'credential_1234567890',
      publicKey: 'public-key-base64url',
      counter: 0,
      deviceId: 'device_1234567890',
    },
    location: { paese_residenza: 'Italia' },
    privacyPolicyConsent: true,
    termsOfServiceConsent: true,
    politicalOpinionsConsent: false,
  };
}

test('passkey: account e identita CIE vengono committati nella stessa transazione', async () => {
  const state = makePool();
  const result = await completePasskeyRegistrationAfterCie({
    registration: registration(),
    fiscalNumber: 'TINIT-ABCDEF12G34H567I',
  }, state.pool);

  assert.equal(result.created, true);
  assert.equal(result.hasPasskey, true);
  const userInsert = state.calls.findIndex(call => call.sql.startsWith('INSERT INTO users'));
  const identityInsert = state.calls.findIndex(call => call.sql.startsWith('INSERT INTO identity_verifications'));
  const commit = state.calls.findIndex(call => call.sql === 'COMMIT');
  assert.ok(userInsert > -1);
  assert.ok(identityInsert > userInsert);
  assert.ok(commit > identityInsert);
  assert.equal(state.calls.some(call => call.sql === 'ROLLBACK'), false);
});

test('passkey: conflitto person_key CIE annulla anche la creazione account', async () => {
  const state = makePool({ duplicatePerson: true });

  await assert.rejects(
    completePasskeyRegistrationAfterCie({
      registration: registration(),
      fiscalNumber: 'TINIT-ABCDEF12G34H567I',
    }, state.pool),
    error => error?.code === 'PERSON_ALREADY_LINKED'
  );

  assert.equal(state.calls.some(call => call.sql === 'ROLLBACK'), true);
  assert.equal(state.calls.some(call => call.sql === 'COMMIT'), false);
});

test('passkey: consensi obbligatori mancanti bloccano prima di aprire il DB', async () => {
  const state = makePool();
  const invalid = registration();
  invalid.privacyPolicyConsent = false;

  await assert.rejects(
    completePasskeyRegistrationAfterCie({
      registration: invalid,
      fiscalNumber: 'TINIT-ABCDEF12G34H567I',
    }, state.pool),
    error => error?.code === 'REGISTRATION_CONSENT_REQUIRED'
  );
  assert.equal(state.connects, 0);
  assert.equal(state.calls.length, 0);
});

test('Passkey: sesso CIE certificato viene salvato prima di COMMIT', async () => {
  const { calls, pool } = makePool();
  await completePasskeyRegistrationAfterCie({
    registration: registration(),
    fiscalNumber: 'TINIT-ABCDEF12G34H567I',
    verifiedCieSex: 'F'
  }, pool);
  const identity = calls.findIndex(c => c.sql.startsWith('INSERT INTO identity_verifications'));
  const sex = calls.findIndex(c => c.sql.startsWith('UPDATE users SET sesso = $1'));
  const commit = calls.findIndex(c => c.sql === 'COMMIT');
  assert.ok(identity >= 0 && sex > identity && commit > sex);
  assert.deepEqual(calls[sex].params, ['F', calls[sex].params[1]]);
  assert.equal(calls.some(c => c.sql === 'ROLLBACK'), false);
});

test('passkey progressiva: attributi M/F e fiscalNumber forgiati dal browser non diventano CIE', async () => {
  const { calls, pool } = makePool();
  const input = { ...registration(), sesso: 'F', genere: 'd', verifiedCieSex: 'M', fiscalNumber: 'TINIT-FORGERY' };
  const result = await completePasskeyRegistrationWithoutCie({ registration: input }, pool);
  assert.equal(result.created, true);
  assert.equal(calls.some(c => c.sql.startsWith('UPDATE users SET sesso')), false);
  assert.equal(calls.some(c => c.sql.startsWith('INSERT INTO identity_verifications')), false);
  assert.equal(calls.some(c => c.sql === 'COMMIT'), true);
});
