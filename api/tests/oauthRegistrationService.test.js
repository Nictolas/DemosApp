const test = require('node:test');
const assert = require('node:assert/strict');

process.env.IDENTITY_HMAC_SECRET = 'test-secret-for-demos-identity-key-1234567890';

const { completeOAuthRegistrationAfterCie } = require('../services/oauthRegistrationService');

function makePool({ duplicatePerson = false } = {}) {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') return { rows: [] };
      if (normalized.includes('FROM user_auth_providers uap')) return { rows: [] };
      if (/SELECT id, ruolo, status FROM users WHERE (google_sub|apple_user_id)/.test(normalized)) return { rows: [] };
      if (normalized.startsWith('INSERT INTO users')) return { rows: [] };
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
