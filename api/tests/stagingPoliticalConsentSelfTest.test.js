const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CONSENT_E2E_USER_ID,
  setPoliticalConsent,
  runStagingPoliticalConsentSelfTest,
} = require('../scripts/stagingPoliticalConsentSelfTest');
const { E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID } = require('../scripts/stagingMigrate');

test('political-consent staging E2E is disabled by default without touching HTTP or DB', async () => {
  const result = await runStagingPoliticalConsentSelfTest({
    env: { NODE_ENV: 'staging' },
    fetchImpl: () => { throw new Error('fetch must not run'); },
    pool: { query: () => { throw new Error('db must not run'); } },
  });
  assert.deepEqual(result, { mode: 'disabled', passed: 0, total: 4 });
});

test('political-consent staging E2E refuses activation outside staging', async () => {
  await assert.rejects(
    runStagingPoliticalConsentSelfTest({
      env: { NODE_ENV: 'production', DEMOS_STAGING_POLITICAL_CONSENT_E2E: 'true' },
      fetchImpl: async () => new Response('{}', { status: 200 }),
      pool: { query: async () => ({ rows: [], rowCount: 0 }) },
    }),
    /allowed only with NODE_ENV=staging/
  );
});

test('political-consent staging fixture uses its own isolated synthetic account', () => {
  assert.notEqual(CONSENT_E2E_USER_ID, E2E_USER_ID);
  assert.notEqual(CONSENT_E2E_USER_ID, E2E_ACTIVIST_USER_ID);
  assert.notEqual(CONSENT_E2E_USER_ID, E2E_ADMIN_USER_ID);
  assert.match(CONSENT_E2E_USER_ID, /^00000000-0000-4000-8000-000000000009$/);
});

test('synthetic consent setter updates both legacy and normalized consent stores', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
      return { rows: [], rowCount: 1 };
    }
  };
  await setPoliticalConsent(pool, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /UPDATE users SET political_opinions_consent = \$2/);
  assert.match(calls[1].sql, /UPDATE user_consents SET political_opinions_consent = \$2/);
  assert.deepEqual(calls[0].params, [CONSENT_E2E_USER_ID, true]);
  assert.deepEqual(calls[1].params, [CONSENT_E2E_USER_ID, true]);
});

test('staging server wires the dedicated fail-closed political-consent E2E flag', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /DEMOS_STAGING_POLITICAL_CONSENT_E2E/);
  assert.match(source, /runStagingPoliticalConsentSelfTest/);
});
