'use strict';

const { E2E_USER_ID } = require('./stagingMigrate');
const {
  runLoadProfile,
  DEFAULT_CONCURRENCY,
  DEFAULT_DURATION_MS,
} = require('./loadTestF1231');

const MAX_STAGING_SELFTEST_CONCURRENCY = 20;
const MAX_STAGING_SELFTEST_DURATION_MS = 60_000;

function positiveBoundedInt(value, fallback, max, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}`);
  }
  return parsed;
}

async function runStagingLoadSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_LOAD_E2E !== 'true') {
    return { mode: 'disabled' };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_LOAD_E2E is allowed only with NODE_ENV=staging');
  }
  if (env.DEMOS_LOAD_ALLOW_REMOTE === 'true') {
    throw new Error('staging self-test must use loopback only; DEMOS_LOAD_ALLOW_REMOTE must remain disabled');
  }
  if (env.DEMOS_LOAD_ALLOW_MUTATIONS === 'true') {
    throw new Error('staging self-test is read-only; DEMOS_LOAD_ALLOW_MUTATIONS must remain disabled');
  }

  const concurrency = positiveBoundedInt(
    env.DEMOS_STAGING_LOAD_CONCURRENCY,
    DEFAULT_CONCURRENCY,
    MAX_STAGING_SELFTEST_CONCURRENCY,
    'DEMOS_STAGING_LOAD_CONCURRENCY',
  );
  const durationMs = positiveBoundedInt(
    env.DEMOS_STAGING_LOAD_DURATION_MS,
    DEFAULT_DURATION_MS,
    MAX_STAGING_SELFTEST_DURATION_MS,
    'DEMOS_STAGING_LOAD_DURATION_MS',
  );
  const requestCount = env.DEMOS_STAGING_LOAD_REQUESTS
    ? positiveBoundedInt(env.DEMOS_STAGING_LOAD_REQUESTS, null, 10_000, 'DEMOS_STAGING_LOAD_REQUESTS')
    : null;

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const token = makeToken({ userId: E2E_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;

  const commonEnv = {
    ...env,
    DEMOS_LOAD_ALLOW_REMOTE: 'false',
    DEMOS_LOAD_ALLOW_HIGH_CONCURRENCY: 'false',
  };
  const profilePlans = [
    { id: 'read-heavy', concurrency, burstMultiplier: 1, allowMutations: false },
    { id: 'burst', concurrency: Math.min(concurrency, 4), burstMultiplier: 5, allowMutations: false },
    { id: 'mixed', concurrency: Math.min(concurrency, 4), burstMultiplier: 1, allowMutations: true },
  ];
  const results = [];

  for (const plan of profilePlans) {
    logger.log(`[staging-load-e2e] starting ${plan.id} load: concurrency=${plan.concurrency}${plan.id === 'burst' ? ` x${plan.burstMultiplier}` : ''} durationMs=${durationMs}${requestCount ? ` requests=${requestCount}` : ''}`);
    const result = await runLoadProfile({
      baseUrl,
      token,
      userId: E2E_USER_ID,
      profile: plan.id,
      durationMs,
      requestCount,
      concurrency: plan.concurrency,
      burstMultiplier: plan.burstMultiplier,
      fetchImpl,
      env: {
        ...commonEnv,
        DEMOS_LOAD_ALLOW_MUTATIONS: plan.allowMutations ? 'true' : 'false',
      },
      logger,
    });

    if (result.failedRequests !== 0 || result.errorRate !== 0) {
      throw new Error(`F12-31 staging ${plan.id} load failed: ${result.failedRequests}/${result.completedRequests} requests failed`);
    }
    if (!Number.isFinite(result.latencyMs?.p95) || result.completedRequests <= 0) {
      throw new Error(`F12-31 staging ${plan.id} load produced invalid metrics`);
    }
    results.push(result);
    logger.log(`[staging-load-e2e] ${plan.id} PASS requests=${result.completedRequests} failed=${result.failedRequests} rps=${result.rps.toFixed(2)} p50=${result.latencyMs.p50.toFixed(1)}ms p95=${result.latencyMs.p95.toFixed(1)}ms p99=${result.latencyMs.p99.toFixed(1)}ms max=${result.latencyMs.max.toFixed(1)}ms bytes=${result.bytesReceived}`);
  }

  logger.log(`[staging-load-e2e] SUMMARY ${JSON.stringify(results.map((result) => ({ profile: result.profile, requests: result.completedRequests, failed: result.failedRequests, rps: Number(result.rps.toFixed(2)), p50Ms: Number(result.latencyMs.p50.toFixed(1)), p95Ms: Number(result.latencyMs.p95.toFixed(1)), p99Ms: Number(result.latencyMs.p99.toFixed(1)), maxMs: Number(result.latencyMs.max.toFixed(1)), bytes: result.bytesReceived })))}`);
  logger.log('[staging-load-e2e] PASS 3/3 profiles');
  return {
    mode: 'staging-load-matrix',
    profiles: results,
    totalRequests: results.reduce((sum, result) => sum + result.completedRequests, 0),
    totalFailedRequests: results.reduce((sum, result) => sum + result.failedRequests, 0),
  };
}

module.exports = {
  MAX_STAGING_SELFTEST_CONCURRENCY,
  MAX_STAGING_SELFTEST_DURATION_MS,
  positiveBoundedInt,
  runStagingLoadSelfTest,
};
