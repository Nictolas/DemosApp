'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  FIXTURE_EVENT_ID,
  SOURCE_ID,
  EXPECTED,
  runStagingElectoralPerimeterSelfTest,
} = require('../scripts/stagingElectoralPerimeterSelfTest');

function noDbPool() {
  return {
    async connect() {
      throw new Error('database must not be touched');
    },
  };
}

test('electoral perimeter staging E2E is disabled by default without touching DB', async () => {
  const result = await runStagingElectoralPerimeterSelfTest({
    env: { NODE_ENV: 'staging' },
    pool: noDbPool(),
  });
  assert.deepEqual(result, { mode: 'disabled', passed: 0, total: 6 });
});

test('electoral perimeter staging E2E refuses activation outside staging', async () => {
  await assert.rejects(
    runStagingElectoralPerimeterSelfTest({
      env: { NODE_ENV: 'production', DEMOS_STAGING_ELECTORAL_PERIMETER_E2E: 'true' },
      pool: noDbPool(),
    }),
    /allowed only with NODE_ENV=staging/,
  );
});

test('staging server wires the dedicated fail-closed electoral perimeter E2E flag', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /DEMOS_STAGING_ELECTORAL_PERIMETER_E2E/);
  assert.match(server, /runStagingElectoralPerimeterSelfTest/);
  assert.match(server, /server\.close\(\(\) => process\.exit\(1\)\)/);
});

test('electoral perimeter staging fixture is isolated and pinned to the official 2022 source', () => {
  assert.equal(FIXTURE_EVENT_ID, '00000000-0000-4000-8000-000000001313');
  assert.equal(SOURCE_ID, 'POLITICHE_20220925');
  assert.deepEqual(EXPECTED, {
    units: 296,
    mappings: 31753,
    municipalityMappings: 31085,
    subMunicipalMappings: 668,
    eligibilityReadyUnits: 254,
    splitMunicipalities: 6,
    splitSections: 6909,
  });
});

test('staging migration verification includes the canonical electoral unit tables', () => {
  const migrate = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'stagingMigrate.js'), 'utf8');
  assert.match(migrate, /'unita_elettorale'/);
  assert.match(migrate, /'unita_elettorale_territorio'/);
  assert.match(migrate, /unita_elettorale\.metadata/);
  assert.match(migrate, /unita_elettorale_territorio\.territory_type/);
  assert.match(migrate, /unita_elettorale_territorio\.territory_code/);
});
