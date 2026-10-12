'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const server = fs.readFileSync(path.join(ROOT, 'api', 'server.js'), 'utf8');
const {
  PODIUM_SUBJECT_ID,
  LEVELS,
  runStagingTransparencyPodiumSelfTest,
} = require('../scripts/stagingTransparencyPodiumSelfTest');

test('Transparency Podium staging E2E is disabled by default without touching HTTP or DB', async () => {
  let touched = false;
  const result = await runStagingTransparencyPodiumSelfTest({
    env: {},
    fetchImpl: async () => { touched = true; throw new Error('unexpected HTTP'); },
    pool: { query: async () => { touched = true; throw new Error('unexpected DB'); } },
    logger: { log() {}, error() {} },
  });
  assert.deepEqual(result, { mode: 'disabled', passed: 0, total: 7 });
  assert.equal(touched, false);
});

test('Transparency Podium staging E2E refuses activation outside staging', async () => {
  await assert.rejects(
    runStagingTransparencyPodiumSelfTest({
      env: { DEMOS_STAGING_TRANSPARENCY_PODIUM_E2E: 'true', NODE_ENV: 'production' },
      fetchImpl: async () => { throw new Error('unexpected HTTP'); },
      pool: { query: async () => { throw new Error('unexpected DB'); } },
      logger: { log() {}, error() {} },
    }),
    /allowed only with NODE_ENV=staging/
  );
});

test('Transparency Podium staging fixture is isolated and covers exactly the five Italian podium levels', () => {
  assert.match(PODIUM_SUBJECT_ID, /^00000000-0000-4000-8000-0000000000[0-9]{2}$/);
  assert.deepEqual(LEVELS.map((item) => item.level), ['EUROPEO', 'CAMERA', 'SENATO', 'REGIONE', 'COMUNE']);
  assert.deepEqual(LEVELS.map((item) => item.field), [
    'rappresentante_europeo',
    'rappresentante_camera',
    'rappresentante_senato',
    'rappresentante_regionale',
    'rappresentante_comune',
  ]);
  assert.equal(new Set(LEVELS.map((item) => item.office)).size, 5);
});

test('staging server wires the dedicated fail-closed Transparency Podium E2E flag', () => {
  assert.match(server, /DEMOS_STAGING_TRANSPARENCY_PODIUM_E2E/);
  assert.match(server, /runStagingTransparencyPodiumSelfTest/);
});

test('Transparency Podium E2E uses only synthetic records and verifies cleanup', () => {
  const script = fs.readFileSync(path.join(ROOT, 'api', 'scripts', 'stagingTransparencyPodiumSelfTest.js'), 'utf8');
  assert.match(script, /E2E_F12_30/);
  assert.match(script, /e2e-f12-30-/);
  assert.match(script, /source:\s*'podio'/);
  assert.match(script, /selection_kind = 'representative'/);
  assert.match(script, /political_office_id = \$2/);
  assert.doesNotMatch(script, /\bkind = 'representative'\b/);
  assert.doesNotMatch(script, /\boffice_id = \$2\b/);
  assert.match(script, /final synthetic Podium cleanup failed/);
  assert.match(script, /DELETE FROM political_selections/);
  assert.match(script, /DELETE FROM comunicazioni/);
  assert.match(script, /DELETE FROM political_mandates/);
});
