'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runStagingMutationSelfTest } = require('../scripts/stagingMutationSelfTest');
const response = (status, body = {}) => ({ status, json: async () => body });

test('mutation gate is disabled unless explicitly enabled', async () => {
  assert.deepEqual(await runStagingMutationSelfTest({ env: {} }), { mode: 'disabled', passed: 0, total: 6 });
});

test('mutation gate refuses non-staging environment', async () => {
  await assert.rejects(() => runStagingMutationSelfTest({ env: { DEMOS_STAGING_MUTATION_E2E: 'true', NODE_ENV: 'production' } }), /only with NODE_ENV=staging/);
});

test('mutation gate verifies event deletion before PASS 6/6', async () => {
  const calls = [];
  const statuses = [202, 404, 200, 200, 200, 200, 404];
  const bodies = [{ data: { id: 42 }, approval: { status: 'PENDING' } }, {}, { data: [{ id: 42, approval_status: 'PENDING' }] }, { data: { approval_status: 'APPROVED' } }, { data: { approval_status: 'APPROVED' } }];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    return response(statuses.shift(), bodies.shift() || {});
  };
  const result = await runStagingMutationSelfTest({ env: { DEMOS_STAGING_MUTATION_E2E: 'true', NODE_ENV: 'staging' }, fetchImpl, tokenFactory: () => 'test-token', logger: { log() {}, error() {} } });
  assert.equal(result.passed, 6);
  assert.equal(calls.length, 7);
  assert.equal(calls.at(-1).method, 'GET');
  assert.match(calls.at(-1).url, /\/api\/eventi\/42$/);
});

test('mutation gate rejects deletion that remains publicly visible', async () => {
  const statuses = [202, 404, 200, 200, 200, 200, 200, 200, 200];
  const bodies = [{ data: { id: 42 }, approval: { status: 'PENDING' } }, {}, { data: [{ id: 42, approval_status: 'PENDING' }] }, { data: { approval_status: 'APPROVED' } }, { data: { approval_status: 'APPROVED' } }];
  const fetchImpl = async () => response(statuses.shift(), bodies.shift() || {});
  await assert.rejects(() => runStagingMutationSelfTest({ env: { DEMOS_STAGING_MUTATION_E2E: 'true', NODE_ENV: 'staging' }, fetchImpl, tokenFactory: () => 'test-token', logger: { log() {}, error() {} } }), /fallback cleanup verification: expected 404, got 200/);
});
