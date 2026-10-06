const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SECURITY_CENTER_DEFAULT_PREFIX,
  buildSecurityCenterMountConfig,
  createReadOnlySecurityCenterService,
  mountSecurityCenterRuntime
} = require('../security-agent/securityCenterMount');

function stagingEnv(overrides = {}) {
  return {
    SECURITY_CENTER_RUNTIME_ENABLED: 'true',
    SECURITY_CENTER_RUNTIME_PREFIX: '/api/security-center',
    SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_STAGING_ID: 'demos-security-staging',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_AGENT_STORE_ENABLED: 'false',
    SECURITY_RETENTION_JOB_ENABLED: 'false',
    SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'false',
    SECURITY_AGENT_SHADOW_ENABLED: 'false',
    SECURITY_AI_SHADOW_INTEGRATION_ENABLED: 'false',
    ...overrides
  };
}

const noop = (_req, _res, next) => next && next();

test('Security Center runtime mount is disabled by default', () => {
  const calls = [];
  const status = mountSecurityCenterRuntime({ app: { use: (...args) => calls.push(args) }, env: {} });
  assert.equal(status.state, 'disabled');
  assert.equal(calls.length, 0);
  assert.equal(status.executable, false);
});

test('enablement fails closed without a passing staging isolation contract', () => {
  for (const patch of [
    { SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'false' },
    { SECURITY_AGENT_ENVIRONMENT_CLASS: 'production' },
    { SECURITY_AGENT_RUNTIME_MODE: 'postgres' },
    { SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'true' }
  ]) {
    const env = stagingEnv(patch);
    const config = buildSecurityCenterMountConfig(env);
    assert.equal(config.ready, false);
    assert.throws(() => mountSecurityCenterRuntime({ app: { use() {} }, env, verifyToken: noop, requireAdmin: noop }), /SECURITY_CENTER_MOUNT_BLOCKED/);
  }
});

test('valid staging config mounts exactly one admin-limited router at the contracted prefix', () => {
  const calls = [];
  const adminLimiter = noop;
  const status = mountSecurityCenterRuntime({
    app: { use: (...args) => calls.push(args) },
    env: stagingEnv(),
    verifyToken: noop,
    requireAdmin: noop,
    adminLimiter
  });
  assert.equal(status.state, 'mounted');
  assert.equal(status.prefix, SECURITY_CENTER_DEFAULT_PREFIX);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], SECURITY_CENTER_DEFAULT_PREFIX);
  assert.equal(calls[0][1], adminLimiter);
  assert.equal(typeof calls[0][2], 'function');
});

test('mounted read-only service exposes policy, approval and boundary views without execution capability', async () => {
  const service = createReadOnlySecurityCenterService({ now: () => new Date('2026-10-06T15:00:00Z') });
  const policy = await service.getAiPolicy({ limit: 5 });
  const approvals = await service.getApprovals({ limit: 5 });
  const boundary = await service.getBoundaryAudit({ limit: 5 });
  assert.equal(policy.status.actionRunnerAvailable, false);
  assert.equal(policy.status.executable, false);
  assert.equal(approvals.status.actionRunnerAvailable, false);
  assert.equal(approvals.status.executionEnabled, false);
  assert.equal(boundary.status.authorized, false);
  assert.equal(boundary.status.executable, false);
  assert.equal(boundary.status.actionRunnerAvailable, false);
});

test('mount status never exposes arbitrary environment values', () => {
  const secret = 'DO_NOT_EXPOSE_RUNTIME_SECRET';
  const status = mountSecurityCenterRuntime({
    app: { use() {} },
    env: stagingEnv({ UNRELATED_SECRET: secret }),
    verifyToken: noop,
    requireAdmin: noop
  });
  assert.equal(JSON.stringify(status).includes(secret), false);
});

test('app wiring is feature-flagged and placed before the 404 handler', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const flagAt = src.indexOf("SECURITY_CENTER_RUNTIME_ENABLED === 'true'");
  const mountAt = src.indexOf('mountSecurityCenterRuntime');
  const notFoundAt = src.indexOf('// Gestione errori 404');
  assert.ok(flagAt >= 0);
  assert.ok(mountAt > flagAt);
  assert.ok(notFoundAt > mountAt);
});

test('invalid runtime prefix fails closed', () => {
  const config = buildSecurityCenterMountConfig(stagingEnv({ SECURITY_CENTER_RUNTIME_PREFIX: '/api/../admin' }));
  assert.equal(config.ready, false);
  assert.ok(config.blockers.includes('mount_prefix_invalid'));
});
