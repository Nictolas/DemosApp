'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  TEST_PREFIX,
  runStagingOpinionProposalSelfTest,
} = require('../scripts/stagingOpinionProposalSelfTest');

function noQueryPool() {
  return {
    async query() {
      throw new Error('database must not be touched');
    },
  };
}

test('opinion proposal staging E2E is disabled by default without touching DB or HTTP', async () => {
  const result = await runStagingOpinionProposalSelfTest({
    env: { NODE_ENV: 'staging' },
    pool: noQueryPool(),
    fetchImpl: async () => { throw new Error('fetch must not be called'); },
  });
  assert.deepEqual(result, { mode: 'disabled', passed: 0, total: 5 });
});

test('opinion proposal staging E2E refuses activation outside staging', async () => {
  await assert.rejects(
    runStagingOpinionProposalSelfTest({
      env: { NODE_ENV: 'production', DEMOS_STAGING_OPINION_PROPOSAL_E2E: 'true' },
      pool: noQueryPool(),
      fetchImpl: async () => ({ status: 200, json: async () => ({}) }),
    }),
    /allowed only with NODE_ENV=staging/,
  );
});

test('staging server wires the dedicated fail-closed proposal lifecycle E2E flag', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /DEMOS_STAGING_OPINION_PROPOSAL_E2E/);
  assert.match(server, /runStagingOpinionProposalSelfTest/);
  assert.match(server, /server\.close\(\(\) => process\.exit\(1\)\)/);
});

test('proposal staging fixture is clearly isolated from normal user content', () => {
  assert.equal(TEST_PREFIX, 'DEMOS E2E F12-21');
});
