const test = require('node:test');
const assert = require('node:assert/strict');

process.env.IDENTITY_HMAC_SECRET = 'test-secret-for-demos-identity-key-1234567890';

const {
  completeOAuthRegistrationWithoutCie,
  completeOAuthRegistrationAfterCie,
} = require('../services/oauthRegistrationService');

function makePool({ duplicatePerson = false, duplicateProviderRace = false } = {}) {
  const calls = [];
  let providerLookupCount = 0;
  let providerInsertCount = 0;
  const client = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') return { rows: [] };
      if (normalized.includes('FROM user_auth_providers uap')) {
        providerLookupCount += 1;
        if (duplicateProviderRace && providerLookupCount >= 2) {
          return { rows: [{ id: 'existing-user-id', ruolo: 'E', status: 'a' }] };
        }
        return { rows: [] };
      }
      if (/SELECT id, ruolo, status FROM users WHERE (google_sub|apple_user_id)/.test(normalized)) return { rows: [] };
      if (normalized.startsWith('UPDATE users SET paese_residenza')) return { rows: [] };
      if (normalized.startsWith('INSERT INTO users')) {
        providerInsertCount += 1;
        if (duplicateProviderRace && providerInsertCount === 1) {
          const error = new Error('duplicate provider identity');
          error.code = '23505';
          error.constraint = 'idx_users_google_sub';
          throw error;
        }
        return { rows: [] };
      }
      if (normalized.startsWith('INSERT INTO user_profile')) return { rows: [] };
      if (normalized.startsWith('INSERT INTO user_consents')) return { rows: [] };
      if (normalized.startsWith('INSERT INTO user_auth_providers')) return { rows: [] };
      if (normalized.startsWith('SELECT person_key, provider, status')) return { rows: [] };
      if (normalized.startsWith('INSERT INTO identity_verifications')) {
        if (duplicatePerson) {
          const error = new Error('duplicate');
          error.code = '23505';
          error.constraint = 'identity_verifications_person_key_key';
          throw error;
        }
        return {
          rows: [{ provider: 'CIE', status: 'verified', verified_at: new Date().toISOString(), detached_at: null, retention_until: null }]
        };
      }
      throw new Error(`Unexpected SQL in test: ${normalized}`);
    },
    release() { calls.push({ sql: 'RELEASE', params: [] }); }
  };
  return { calls, pool: { async connect() { return client; } } };
}

function registration() {
  return {
    provider: 'google',
    providerSub: 'google-sub-1',
    email: 'person@example.test',
    givenName: 'Test',
    familyName: 'Person',
    location: { paese_residenza: 'Italia' },
    privacyPolicyConsent: true,
    termsOfServiceConsent: true,
    politicalOpinionsConsent: false,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent'
  };
}

test('crea account e identita CIE nella stessa transazione, con CIE prima del COMMIT', async () => {
  const { calls, pool } = makePool();
  const result = await completeOAuthRegistrationAfterCie({
    registration: registration(),
    fiscalNumber: 'TINIT-ABCDEF12G34H567I'
  }, pool);

  assert.equal(result.created, true);
  assert.equal(result.role, 'E');
  const identityIndex = calls.findIndex(call => call.sql.startsWith('INSERT INTO identity_verifications'));
  const commitIndex = calls.findIndex(call => call.sql === 'COMMIT');
  assert.ok(identityIndex > -1);
  assert.ok(commitIndex > identityIndex);
  assert.equal(calls.some(call => call.sql === 'ROLLBACK'), false);
});

test('se la persona CIE e gia collegata, rollback completo e nessun COMMIT', async () => {
  const { calls, pool } = makePool({ duplicatePerson: true });

  await assert.rejects(
    completeOAuthRegistrationAfterCie({
      registration: registration(),
      fiscalNumber: 'TINIT-ABCDEF12G34H567I'
    }, pool),
    error => error?.code === 'PERSON_ALREADY_LINKED'
  );

  assert.equal(calls.some(call => call.sql === 'ROLLBACK'), true);
  assert.equal(calls.some(call => call.sql === 'COMMIT'), false);
});

test('rifiuta la finalizzazione senza consensi obbligatori prima di aprire la transazione', async () => {
  const { calls, pool } = makePool();
  const invalid = registration();
  invalid.termsOfServiceConsent = false;

  await assert.rejects(
    completeOAuthRegistrationAfterCie({ registration: invalid, fiscalNumber: 'TINIT-ABCDEF12G34H567I' }, pool),
    error => error?.code === 'REGISTRATION_CONSENT_REQUIRED'
  );
  assert.equal(calls.length, 0);
});

test('una doppia finalizzazione Google concorrente recupera l account gia creato invece di restituire 503', async () => {
  const { calls, pool } = makePool({ duplicateProviderRace: true });

  const result = await completeOAuthRegistrationWithoutCie({ registration: registration() }, pool);

  assert.equal(result.created, false);
  assert.equal(result.userId, 'existing-user-id');
  assert.equal(result.role, 'E');
  assert.equal(calls.filter(call => call.sql === 'BEGIN').length, 2);
  assert.equal(calls.filter(call => call.sql === 'ROLLBACK').length, 1);
  assert.equal(calls.filter(call => call.sql === 'COMMIT').length, 1);
  assert.equal(calls.some(call => call.sql.startsWith('UPDATE users SET paese_residenza')), true);
  assert.equal(calls.some(call => call.sql.startsWith('INSERT INTO user_auth_providers')), true);
});

test('ordinary OAuth account never persists provider full names', async () => {
  const { calls, pool } = makePool();
  const profile = registration();
  profile.givenName = 'Sensitive';
  profile.familyName = 'Identity';
  await completeOAuthRegistrationAfterCie({
    registration: profile,
    fiscalNumber: 'TINIT-ABCDEF12G34H567I'
  }, pool);

  const userInsert = calls.find(call => call.sql.startsWith('INSERT INTO users'));
  assert.ok(userInsert);
  assert.equal(userInsert.params[2], null, 'nome must not be persisted');
  assert.equal(userInsert.params[3], null, 'cognome must not be persisted');
  const providerInsert = calls.find(call => call.sql.startsWith('INSERT INTO user_auth_providers'));
  assert.ok(providerInsert);
  assert.equal(JSON.stringify(providerInsert.params).includes('Sensitive'), false);
  assert.equal(JSON.stringify(providerInsert.params).includes('Identity'), false);
});
