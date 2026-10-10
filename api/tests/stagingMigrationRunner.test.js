'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPECTED_DATABASE,
  E2E_USER_ID,
  MIGRATIONS,
  assertMigrationFilesExist,
  assertStagingUrl,
  seedE2EUser,
  run,
} = require('../scripts/stagingMigrate');

test('staging migration runner targets only the dedicated civic staging database', () => {
  assert.equal(EXPECTED_DATABASE, 'demos_civic_staging_db');
  assert.deepEqual(assertStagingUrl('postgresql://user:secret@example.invalid/demos_civic_staging_db'), {
    databaseName: 'demos_civic_staging_db',
  });
  assert.throws(
    () => assertStagingUrl('postgresql://user:secret@example.invalid/demos'),
    /Refusing database demos/,
  );
  assert.throws(() => assertStagingUrl(undefined), /STAGING_DATABASE_URL is required/);
});

test('migration bundle exists and keeps foundational dependencies first', () => {
  assert.doesNotThrow(() => assertMigrationFilesExist());
  assert.equal(MIGRATIONS[0], 'api/database/create-account-capabilities-model.sql');
  assert.ok(MIGRATIONS.indexOf('api/database/create-candidacy-program-model.sql') > 0);
  assert.ok(
    MIGRATIONS.indexOf('api/database/create-candidacy-program-model.sql') >
      MIGRATIONS.indexOf('api/database/create-account-capabilities-model.sql'),
  );
  assert.ok(MIGRATIONS.includes('20261009_civic_processes.sql'));
  assert.ok(MIGRATIONS.includes('20261010_municipal_institutional_communications.sql'));
});

test('plan mode never needs a database connection and reports the full bundle', async () => {
  const lines = [];
  const result = await run({
    env: {},
    argv: ['--plan'],
    logger: { log: (line) => lines.push(String(line)) },
  });
  assert.equal(result.mode, 'plan');
  assert.equal(result.migrationCount, MIGRATIONS.length);
  assert.match(lines[0], /demos_civic_staging_db/);
});

test('apply mode is double-gated before any connection attempt', async () => {
  await assert.rejects(
    run({ env: { STAGING_DATABASE_URL: 'postgresql://u:p@example.invalid/demos_civic_staging_db' }, argv: ['--apply'], logger: { log() {} } }),
    /ALLOW_DEMOS_STAGING_MIGRATIONS=true/,
  );
});

test('e2e seed is fixed, synthetic, idempotent SQL and double-gated', async () => {
  const calls = [];
  await seedE2EUser({ query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } }, { log() {} });
  assert.equal(E2E_USER_ID, '00000000-0000-4000-8000-000000000001');
  assert.match(calls[0].sql, /INSERT INTO users/i);
  assert.match(calls[0].sql, /ON CONFLICT \(id\) DO UPDATE/i);
  assert.equal(calls[0].params[0], E2E_USER_ID);
  assert.ok(calls[0].params.every((value) => !String(value).includes('@')));

  await assert.rejects(
    run({ env: { STAGING_DATABASE_URL: 'postgresql://u:p@example.invalid/demos_civic_staging_db' }, argv: ['--seed-e2e'], logger: { log() {} } }),
    /ALLOW_DEMOS_STAGING_E2E_SEED=true/,
  );
});
