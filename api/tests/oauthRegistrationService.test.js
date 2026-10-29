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


test('Google: registrazione elettore non salva nome/cognome neanche se inviati dal provider', async () => {
  const { calls, pool } = makePool();
  const input = registration();
  input.givenName = 'SensitiveGivenNameUnique';
  input.familyName = 'SensitiveFamilyNameUnique';
  input.name = 'SensitiveFullNameUnique';

  const result = await completeOAuthRegistrationWithoutCie({ registration: input }, pool);
  assert.equal(result.created, true);
  const insert = calls.find(call => call.sql.startsWith('INSERT INTO users'));
  assert.ok(insert);
  assert.doesNotMatch(insert.sql, /\b(?:nome|cognome|name)\b/i);
  assert.ok(!insert.params.some(p => typeof p === 'string' && p.includes('Sensitive')));
  const providerInsert = calls.find(call => call.sql.startsWith('INSERT INTO user_auth_providers'));
  assert.ok(providerInsert);
  assert.equal(providerInsert.params[3], '{}');
  assert.ok(calls.every(call => !JSON.stringify(call.params).includes('Sensitive')));
});

test('Apple: nessun segnaposto OAuth in nome/cognome e nessuna PII nei metadati', async () => {
  const { calls, pool } = makePool();
  const input = { ...registration(), provider:'apple', providerSub:'apple-user-stub',
    givenName: 'SensitiveGivenNameUnique', familyName:'SensitiveFamilyNameUnique' };
  const result = await completeOAuthRegistrationWithoutCie({ registration: input }, pool);
  assert.equal(result.created,true);
  const insert = calls.find(call => call.sql.startsWith('INSERT INTO users'));
  assert.ok(insert.sql.includes('apple_user_id'));
  assert.doesNotMatch(insert.sql, /\b(?:nome|cognome|name)\b/i);
  assert.equal(calls.find(call => call.sql.startsWith('INSERT INTO user_auth_providers')).params[3], '{}');
  assert.ok(calls.every(call => !JSON.stringify(call.params).includes('Sensitive')));
});

test('Google e Apple non richiedono più scopes nome/profilo né propagano dati nominali nei JWT pending', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = rel => fs.readFileSync(path.resolve(__dirname,'../..',rel),'utf8');
  const frontend=read('client/src/lib/oauth.ts');
  const oauth=read('api/routes/auth/oauth.js');
  const service=read('api/services/oauthRegistrationService.js');
  assert.match(frontend,/const scope = "openid email";/);
  assert.match(frontend,/scope: "email",/);
  assert.doesNotMatch(frontend,/openid email profile|scope: "name email"/);
  for (const source of [oauth,service]) {
    assert.doesNotMatch(source,/payload\.name|payload\.given_name|payload\.family_name/);
    assert.doesNotMatch(source,/registration\.givenName|registration\.familyName|registration\.name/);
  }
  assert.doesNotMatch(oauth,/profile\.(?:given_name|family_name|name)/);
  assert.match(service,/JSON\.stringify\(\{\}\)/);
});
