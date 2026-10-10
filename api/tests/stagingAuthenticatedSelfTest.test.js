'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CASES, runStagingAuthenticatedSelfTest } = require('../scripts/stagingAuthenticatedSelfTest');

test('authenticated staging E2E is disabled by default', async () => {
  const result = await runStagingAuthenticatedSelfTest({
    env: { NODE_ENV: 'staging' },
    fetchImpl: async () => { throw new Error('must not run'); },
    tokenFactory: () => 'unused',
  });
  assert.deepEqual(result, { mode: 'disabled', passed: 0, total: CASES.length });
});

test('authenticated staging E2E refuses activation outside staging', async () => {
  await assert.rejects(
    () => runStagingAuthenticatedSelfTest({
      env: { NODE_ENV: 'production', DEMOS_STAGING_AUTH_E2E: 'true' },
      fetchImpl: async () => ({ status: 200 }),
      tokenFactory: () => 'test-token',
    }),
    /only with NODE_ENV=staging/,
  );
});

test('authenticated staging E2E covers profile, protected reads, Admin denial and anonymous denial', async () => {
  const statuses = new Map(CASES.map((item) => [`${item.path}|${item.authenticated}`, item.expected]));
  const calls = [];
  const result = await runStagingAuthenticatedSelfTest({
    env: { NODE_ENV: 'staging', DEMOS_STAGING_AUTH_E2E: 'true' },
    port: 9999,
    tokenFactory: ({ userId }) => {
      assert.equal(userId, '00000000-0000-4000-8000-000000000001');
      return 'synthetic-token';
    },
    fetchImpl: async (url, options) => {
      const parsed = new URL(url);
      const authenticated = Boolean(options.headers.Authorization);
      calls.push({ path: parsed.pathname, authenticated, authorization: options.headers.Authorization || null });
      return { status: statuses.get(`${parsed.pathname}|${authenticated}`) };
    },
    logger: { log() {} },
  });
  assert.equal(result.passed, 5);
  assert.equal(result.total, 5);
  assert.equal(calls[0].authorization, 'Bearer synthetic-token');
  assert.equal(calls.at(-1).authorization, null);
});

test('authenticated staging E2E fails closed on an unexpected status', async () => {
  await assert.rejects(
    () => runStagingAuthenticatedSelfTest({
      env: { NODE_ENV: 'staging', DEMOS_STAGING_AUTH_E2E: 'true' },
      tokenFactory: () => 'synthetic-token',
      fetchImpl: async () => ({ status: 500 }),
      logger: { log() {} },
    }),
    /Authenticated E2E failed/,
  );
});
