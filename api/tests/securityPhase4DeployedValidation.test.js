const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VALIDATION_ROUTES,
  buildPhase4DeployedValidationConfig,
  findCapabilityViolations,
  runPhase4DeployedValidation
} = require('../security-agent/securityPhase4DeployedValidation');

const TOKEN = ['stage', 'admin', 'token', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].join('_');

function env(overrides = {}) {
  return {
    SECURITY_PHASE4_DEPLOYED_VALIDATION_ENABLED: 'true',
    SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_STAGING_ID: 'demos-security-staging',
    SECURITY_PHASE4_STAGING_ORIGIN: 'https://security-staging.example.test',
    SECURITY_PHASE4_STAGING_HOST_ALLOWLIST: 'security-staging.example.test',
    SECURITY_PHASE4_SECURITY_CENTER_PREFIX: '/api/security-center',
    SECURITY_PHASE4_VALIDATION_TIMEOUT_MS: '5000',
    SECURITY_PHASE4_STAGING_ADMIN_TOKEN: TOKEN,
    ...overrides
  };
}

function safePayload(route) {
  if (route.endsWith('/ai-policy?limit=20')) return { status: { actionRunnerAvailable: false, executable: false }, decisions: [] };
  if (route.endsWith('/approvals?limit=20')) return { status: { actionRunnerAvailable: false, executionEnabled: false }, approvals: [], audit: [] };
  return { status: { authorized: false, executable: false, actionRunnerAvailable: false }, audit: [] };
}

function fakeFetch({ mutate, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const payload = typeof mutate === 'function' ? mutate(safePayload(url), url) : safePayload(url);
    return { ok: status === 200, status, async json() { return payload; } };
  };
  return { calls, fetchImpl };
}

test('phase 4 deployed validation is disabled by default and makes no network call', async () => {
  const f = fakeFetch();
  const result = await runPhase4DeployedValidation({ env: {}, fetchImpl: f.fetchImpl });
  assert.equal(result.status, 'disabled');
  assert.equal(f.calls.length, 0);
});

test('staging isolation, exact host allowlist and credential are mandatory before transport', async () => {
  for (const patch of [
    { SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'false' },
    { SECURITY_AGENT_ENVIRONMENT_CLASS: 'production' },
    { SECURITY_PHASE4_STAGING_HOST_ALLOWLIST: 'other.example.test' },
    { SECURITY_PHASE4_STAGING_ADMIN_TOKEN: '' }
  ]) {
    const f = fakeFetch();
    const result = await runPhase4DeployedValidation({ env: env(patch), fetchImpl: f.fetchImpl });
    assert.equal(result.status, 'blocked');
    assert.equal(f.calls.length, 0);
  }
});

test('non-HTTPS and production-like hosts are blocked even if allowlisted', () => {
  assert.equal(buildPhase4DeployedValidationConfig(env({ SECURITY_PHASE4_STAGING_ORIGIN: 'http://security-staging.example.test' })).ready, false);
  const prod = env({ SECURITY_PHASE4_STAGING_ORIGIN: 'https://security-prod.example.test', SECURITY_PHASE4_STAGING_HOST_ALLOWLIST: 'security-prod.example.test' });
  const config = buildPhase4DeployedValidationConfig(prod);
  assert.equal(config.ready, false);
  assert.ok(config.blockers.includes('production_like_host_forbidden'));
});

test('accepted validation uses only contracted GET routes and never sends a body', async () => {
  const f = fakeFetch();
  const result = await runPhase4DeployedValidation({ env: env(), fetchImpl: f.fetchImpl });
  assert.equal(result.status, 'accepted');
  assert.equal(result.checkedCount, VALIDATION_ROUTES.length);
  assert.equal(f.calls.length, VALIDATION_ROUTES.length);
  for (const call of f.calls) {
    assert.equal(call.options.method, 'GET');
    assert.equal(Object.prototype.hasOwnProperty.call(call.options, 'body'), false);
    assert.equal(call.options.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(call.options.headers['X-DEMOS-Staging-ID'], 'demos-security-staging');
  }
});

test('any true execution capability rejects the deployed evidence', async () => {
  const f = fakeFetch({ mutate(payload, url) {
    if (url.includes('/ai-policy')) return { ...payload, nested: { executable: true } };
    return payload;
  } });
  const result = await runPhase4DeployedValidation({ env: env(), fetchImpl: f.fetchImpl });
  assert.equal(result.status, 'rejected');
  assert.equal(result.errorCode, 'EXECUTION_CAPABILITY_DETECTED');
  assert.equal(result.routes[0].violationCount, 1);
  assert.equal(f.calls.length, 1);
});

test('scanner detects all forbidden true capability keys recursively', () => {
  const violations = findCapabilityViolations({ a: { authorized: true }, b: [{ actionRunnerAvailable: true }], executionEnabled: true, writeAccess: true });
  assert.equal(violations.length, 4);
});

test('HTTP/provider failures stay generic and never expose the admin token', async () => {
  const f = fakeFetch({ status: 401 });
  const result = await runPhase4DeployedValidation({ env: env(), fetchImpl: f.fetchImpl });
  assert.equal(result.status, 'error');
  assert.equal(result.errorCode, 'PHASE4_DEPLOYED_VALIDATION_FAILED');
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('public config/result never expose staging credential', async () => {
  const config = buildPhase4DeployedValidationConfig(env());
  assert.equal(JSON.stringify(config).includes(TOKEN), false);
  const result = await runPhase4DeployedValidation({ env: env(), fetchImpl: fakeFetch().fetchImpl });
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  assert.equal(result.authorized, false);
  assert.equal(result.executable, false);
  assert.equal(result.actionRunnerAvailable, false);
});
