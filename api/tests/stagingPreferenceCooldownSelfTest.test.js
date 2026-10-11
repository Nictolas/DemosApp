'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SCOPE,
  runStagingPreferenceCooldownSelfTest,
} = require('../scripts/stagingPreferenceCooldownSelfTest');

function noQueryPool() {
  return {
    async query() {
      throw new Error('database must not be touched');
    },
  };
}

test('preference cooldown staging E2E is disabled by default without touching DB or HTTP', async () => {
  const result = await runStagingPreferenceCooldownSelfTest({
    env: { NODE_ENV: 'staging' },
    pool: noQueryPool(),
    fetchImpl: async () => { throw new Error('fetch must not be called'); },
  });
  assert.deepEqual(result, { mode: 'disabled', passed: 0, total: 5 });
});

test('preference cooldown staging E2E refuses activation outside staging', async () => {
  await assert.rejects(
    runStagingPreferenceCooldownSelfTest({
      env: { NODE_ENV: 'production', DEMOS_STAGING_PREFERENCE_COOLDOWN_E2E: 'true' },
      pool: noQueryPool(),
      fetchImpl: async () => ({ status: 200, json: async () => ({}) }),
    }),
    /allowed only with NODE_ENV=staging/,
  );
});

test('staging server wires the dedicated fail-closed preference cooldown E2E flag', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /DEMOS_STAGING_PREFERENCE_COOLDOWN_E2E/);
  assert.match(server, /runStagingPreferenceCooldownSelfTest/);
  assert.match(server, /server\.close\(\(\) => process\.exit\(1\)\)/);
});

test('preference cooldown staging fixture targets an existing isolated staging surface', () => {
  assert.equal(SCOPE, 'iniziative-popolari:preferenza');
});
