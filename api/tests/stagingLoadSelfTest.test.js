'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  MAX_STAGING_SELFTEST_CONCURRENCY,
  MAX_STAGING_SELFTEST_DURATION_MS,
  positiveBoundedInt,
  runStagingLoadSelfTest,
} = require('../scripts/stagingLoadSelfTest');

const ROOT = path.resolve(__dirname, '..', '..');
const server = fs.readFileSync(path.join(ROOT, 'api', 'server.js'), 'utf8');

test('staging F12-31 load self-test is disabled by default without issuing requests', async () => {
  let touched = false;
  const result = await runStagingLoadSelfTest({
    env: {},
    fetchImpl: async () => { touched = true; throw new Error('unexpected HTTP'); },
    logger: { log() {}, error() {} },
  });
  assert.deepEqual(result, { mode: 'disabled' });
  assert.equal(touched, false);
});

test('staging F12-31 load self-test refuses non-staging and remote/mutation overrides', async () => {
  await assert.rejects(
    runStagingLoadSelfTest({ env: { DEMOS_STAGING_LOAD_E2E: 'true', NODE_ENV: 'production' } }),
    /allowed only with NODE_ENV=staging/
  );
  await assert.rejects(
    runStagingLoadSelfTest({
      env: { DEMOS_STAGING_LOAD_E2E: 'true', NODE_ENV: 'staging', DEMOS_LOAD_ALLOW_REMOTE: 'true' },
    }),
    /must use loopback only/
  );
  await assert.rejects(
    runStagingLoadSelfTest({
      env: { DEMOS_STAGING_LOAD_E2E: 'true', NODE_ENV: 'staging', DEMOS_LOAD_ALLOW_MUTATIONS: 'true' },
    }),
    /read-only/
  );
});

test('staging load bounds are deliberately lower than the generic harness safety ceiling', () => {
  assert.equal(MAX_STAGING_SELFTEST_CONCURRENCY, 20);
  assert.equal(MAX_STAGING_SELFTEST_DURATION_MS, 60_000);
  assert.equal(positiveBoundedInt('20', 4, 20, 'c'), 20);
  assert.throws(() => positiveBoundedInt('21', 4, 20, 'c'), /between 1 and 20/);
  assert.throws(() => positiveBoundedInt('60001', 10000, 60000, 'd'), /between 1 and 60000/);
});

test('staging server wires the dedicated F12-31 load flag', () => {
  assert.match(server, /DEMOS_STAGING_LOAD_E2E/);
  assert.match(server, /runStagingLoadSelfTest/);
});

test('staging F12-31 self-test produces metrics through loopback and accepts zero failures only', async () => {
  const responses = [];
  const fetchImpl = async (url) => {
    responses.push(String(url));
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await runStagingLoadSelfTest({
    env: {
      DEMOS_STAGING_LOAD_E2E: 'true',
      NODE_ENV: 'staging',
      DEMOS_STAGING_LOAD_REQUESTS: '8',
      DEMOS_STAGING_LOAD_CONCURRENCY: '2',
    },
    port: 3999,
    tokenFactory: () => 'synthetic-token',
    fetchImpl,
    logger: { log() {}, error() {} },
  });
  assert.equal(result.mode, 'staging-read-heavy-load');
  assert.equal(result.completedRequests, 8);
  assert.equal(result.failedRequests, 0);
  assert.equal(result.localTarget, true);
  assert.equal(result.mutations, false);
  assert.ok(responses.every((url) => url.startsWith('http://127.0.0.1:3999/')));
  assert.deepEqual(new Set(responses.map((url) => new URL(url).pathname)), new Set([
    '/api/auth/me', '/api/eventi', '/api/opinioni', '/api/opinioni/profile',
  ]));
});
