'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runStagingBootGate } = require('../scripts/stagingBoot');

test('staging boot gate is disabled by default', async () => {
  let called = false;
  const result = await runStagingBootGate({
    env: { NODE_ENV: 'staging' },
    runner: async () => { called = true; },
  });
  assert.equal(called, false);
  assert.deepEqual(result, { mode: 'disabled' });
});

test('staging boot gate refuses activation outside staging', async () => {
  await assert.rejects(
    () => runStagingBootGate({
      env: { NODE_ENV: 'production', DEMOS_STAGING_MIGRATION_MODE: 'preflight', DATABASE_URL: 'postgres://u:p@h/db' },
      runner: async () => {},
    }),
    /only with NODE_ENV=staging/,
  );
});

test('preflight maps the service DATABASE_URL to the guarded staging runner', async () => {
  const calls = [];
  const expected = { mode: 'preflight-ok' };
  const result = await runStagingBootGate({
    env: { NODE_ENV: 'staging', DEMOS_STAGING_MIGRATION_MODE: 'preflight', DATABASE_URL: 'postgres://u:p@h/demos_civic_staging_db' },
    runner: async (input) => { calls.push(input); return expected; },
  });
  assert.equal(result, expected);
  assert.deepEqual(calls[0].argv, ['--preflight']);
  assert.equal(calls[0].env.STAGING_DATABASE_URL, 'postgres://u:p@h/demos_civic_staging_db');
  assert.notEqual(calls[0].env.ALLOW_DEMOS_STAGING_MIGRATIONS, 'true');
});

test('apply explicitly enables the guarded staging runner', async () => {
  const calls = [];
  await runStagingBootGate({
    env: { NODE_ENV: 'staging', DEMOS_STAGING_MIGRATION_MODE: 'apply', DATABASE_URL: 'postgres://u:p@h/demos_civic_staging_db' },
    runner: async (input) => { calls.push(input); return { mode: 'apply-ok' }; },
  });
  assert.deepEqual(calls[0].argv, ['--apply']);
  assert.equal(calls[0].env.ALLOW_DEMOS_STAGING_MIGRATIONS, 'true');
});

test('baseline explicitly enables only the guarded staging baseline', async () => {
  const calls = [];
  await runStagingBootGate({
    env: { NODE_ENV: 'staging', DEMOS_STAGING_MIGRATION_MODE: 'baseline', DATABASE_URL: 'postgres://u:p@h/demos_civic_staging_db' },
    runner: async (input) => { calls.push(input); return { mode: 'baseline-ok' }; },
  });
  assert.deepEqual(calls[0].argv, ['--baseline']);
  assert.equal(calls[0].env.ALLOW_DEMOS_STAGING_BASELINE, 'true');
  assert.notEqual(calls[0].env.ALLOW_DEMOS_STAGING_MIGRATIONS, 'true');
});

test('e2e seed explicitly enables only the staging synthetic-user gate', async () => {
  const calls = [];
  await runStagingBootGate({
    env: { NODE_ENV: 'staging', DEMOS_STAGING_MIGRATION_MODE: 'e2e-seed', DATABASE_URL: 'postgres://u:p@h/demos_civic_staging_db' },
    runner: async (input) => { calls.push(input); return { mode: 'seed-ok' }; },
  });
  assert.deepEqual(calls[0].argv, ['--seed-e2e']);
  assert.equal(calls[0].env.ALLOW_DEMOS_STAGING_E2E_SEED, 'true');
  assert.notEqual(calls[0].env.ALLOW_DEMOS_STAGING_MIGRATIONS, 'true');
});
