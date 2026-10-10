'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPECTED_DATABASE,
  MIGRATIONS,
  assertMigrationFilesExist,
  assertStagingUrl,
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
