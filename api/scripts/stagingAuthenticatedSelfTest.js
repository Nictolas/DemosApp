'use strict';

const { E2E_USER_ID } = require('./stagingMigrate');

const CASES = Object.freeze([
  { path: '/api/auth/me', authenticated: true, expected: 200 },
  { path: '/api/eventi', authenticated: true, expected: 200 },
  { path: '/api/podio-trasparenza', authenticated: true, expected: 200 },
  { path: '/api/comunicazioni/debug-firebase-admin', authenticated: true, expected: 403 },
  { path: '/api/eventi', authenticated: false, expected: 401 },
]);

async function runStagingAuthenticatedSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  logger = console,
} = {}) {
  const enabled = env.DEMOS_STAGING_AUTH_E2E === 'true';
  if (!enabled) return { mode: 'disabled', passed: 0, total: CASES.length };
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_AUTH_E2E is allowed only with NODE_ENV=staging');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging authenticated E2E');

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const token = makeToken({ userId: E2E_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;
  let passed = 0;

  for (const item of CASES) {
    const headers = item.authenticated ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetchImpl(`${baseUrl}${item.path}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const ok = response.status === item.expected;
    logger.log(`[staging-e2e] ${item.path} auth=${item.authenticated} expected=${item.expected} got=${response.status} ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) throw new Error(`Authenticated E2E failed for ${item.path}: expected ${item.expected}, got ${response.status}`);
    passed += 1;
  }

  logger.log(`[staging-e2e] PASS ${passed}/${CASES.length}`);
  return { mode: 'authenticated-e2e', passed, total: CASES.length };
}

module.exports = { CASES, runStagingAuthenticatedSelfTest };
