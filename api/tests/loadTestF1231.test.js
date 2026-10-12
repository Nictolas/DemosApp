'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  READ_CASES,
  MIXED_MUTATION_CASES,
  percentile,
  validateTarget,
  buildProfile,
  runLoadProfile,
  parseArgs,
} = require('../scripts/loadTestF1231');

const silentLogger = { log() {}, error() {} };

function okFetch(counter = null) {
  return async (url, options = {}) => {
    if (counter) counter.push({ url: String(url), method: options.method, body: options.body || null });
    return new Response('{"success":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

test('F12-31 profiles use only current DEMOS routes and keep writes out of read/burst profiles', () => {
  assert.deepEqual(
    READ_CASES.map((item) => [item.name, item.method, item.path]),
    [
      ['auth-me', 'GET', '/api/auth/me'],
      ['eventi', 'GET', '/api/eventi'],
      ['opinioni', 'GET', '/api/opinioni'],
      ['opinioni-profile', 'GET', '/api/opinioni/profile'],
    ],
  );
  assert.equal(READ_CASES.some((item) => item.mutation), false);
  assert.equal(MIXED_MUTATION_CASES.length, 1);
  assert.equal(MIXED_MUTATION_CASES[0].method, 'PUT');
  assert.equal(MIXED_MUTATION_CASES[0].path, '/api/users/{userId}/political-selection');
});

test('remote load target is staging-only and requires an explicit opt-in', () => {
  assert.equal(validateTarget('http://127.0.0.1:3001', {}).local, true);
  assert.throws(
    () => validateTarget('https://demos-backend.onrender.com', { NODE_ENV: 'production', DEMOS_LOAD_ALLOW_REMOTE: 'true' }),
    /only with NODE_ENV=staging/,
  );
  assert.throws(
    () => validateTarget('https://demos-functional-staging.onrender.com', { NODE_ENV: 'staging' }),
    /DEMOS_LOAD_ALLOW_REMOTE=true/,
  );
  const allowed = validateTarget('https://demos-functional-staging.onrender.com', {
    NODE_ENV: 'staging',
    DEMOS_LOAD_ALLOW_REMOTE: 'true',
  });
  assert.equal(allowed.local, false);
});

test('mixed profile is fail-closed unless mutations and a dedicated user are explicit', () => {
  assert.throws(() => buildProfile({ profile: 'mixed', userId: 'u1', allowMutations: false }), /ALLOW_MUTATIONS/);
  assert.throws(() => buildProfile({ profile: 'mixed', allowMutations: true }), /LOAD_USER_ID/);
  const mixed = buildProfile({ profile: 'mixed', userId: 'u1', allowMutations: true });
  assert.equal(mixed.mutations, true);
  assert.equal(mixed.cases.length, READ_CASES.length + 1);
});

test('percentiles are deterministic and use nearest-rank semantics', () => {
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([9, 1, 5, 3], 0.50), 3);
  assert.equal(percentile([9, 1, 5, 3], 0.95), 9);
  assert.equal(percentile([9, 1, 5, 3], 0.99), 9);
});

test('read-heavy runner produces request, latency, status, endpoint and byte metrics', async () => {
  const calls = [];
  const result = await runLoadProfile({
    baseUrl: 'http://127.0.0.1:3001',
    token: 'test-token',
    profile: 'read-heavy',
    requestCount: 12,
    concurrency: 3,
    fetchImpl: okFetch(calls),
    env: {},
    logger: silentLogger,
  });

  assert.equal(result.profile, 'read-heavy');
  assert.equal(result.completedRequests, 12);
  assert.equal(result.failedRequests, 0);
  assert.equal(result.errorRate, 0);
  assert.equal(result.configuredConcurrency, 3);
  assert.equal(result.statusCounts[200], 12);
  assert.ok(result.rps > 0);
  assert.ok(result.latencyMs.p50 >= 0);
  assert.ok(result.latencyMs.p95 >= result.latencyMs.p50);
  assert.ok(result.bytesReceived > 0);
  assert.deepEqual(Object.keys(result.endpoints).sort(), READ_CASES.map((item) => item.name).sort());
  assert.equal(calls.every((call) => call.method === 'GET'), true);
  assert.equal(calls.every((call) => call.url.startsWith('http://127.0.0.1:3001/')), true);
});

test('mixed runner exercises idempotent political-selection write only after explicit staging-style opt-in', async () => {
  const calls = [];
  const result = await runLoadProfile({
    baseUrl: 'http://127.0.0.1:3001',
    token: 'test-token',
    userId: 'load-user',
    profile: 'mixed',
    requestCount: 10,
    concurrency: 2,
    fetchImpl: okFetch(calls),
    env: { DEMOS_LOAD_ALLOW_MUTATIONS: 'true' },
    logger: silentLogger,
  });

  assert.equal(result.mutations, true);
  const writes = calls.filter((call) => call.method === 'PUT');
  assert.equal(writes.length, 2);
  assert.equal(writes.every((call) => call.url.endsWith('/api/users/load-user/political-selection')), true);
  assert.equal(writes.every((call) => JSON.parse(call.body).officeId === 'it.camera'), true);
  assert.equal(writes.every((call) => JSON.parse(call.body).selectedUserId === null), true);
});

test('burst multiplies concurrency but remains read-only', async () => {
  const calls = [];
  const result = await runLoadProfile({
    baseUrl: 'http://localhost:3001',
    token: 'test-token',
    profile: 'burst',
    requestCount: 12,
    concurrency: 2,
    burstMultiplier: 3,
    fetchImpl: okFetch(calls),
    env: {},
    logger: silentLogger,
  });
  assert.equal(result.configuredConcurrency, 6);
  assert.equal(result.mutations, false);
  assert.equal(calls.every((call) => call.method === 'GET'), true);
});

test('high concurrency needs a second explicit safety override', async () => {
  await assert.rejects(
    runLoadProfile({
      baseUrl: 'http://127.0.0.1:3001',
      token: 'test-token',
      profile: 'read-heavy',
      requestCount: 1,
      concurrency: 51,
      fetchImpl: okFetch(),
      env: {},
      logger: silentLogger,
    }),
    /exceeds safe default/,
  );
});

test('CLI parser accepts explicit profile and bounded-load arguments', () => {
  assert.deepEqual(parseArgs([
    '--profile=burst',
    '--requests=250',
    '--concurrency=5',
    '--base-url=http://127.0.0.1:3001',
  ]), {
    profile: 'burst',
    requests: '250',
    concurrency: '5',
    'base-url': 'http://127.0.0.1:3001',
  });
});
