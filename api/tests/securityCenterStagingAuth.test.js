const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSecurityCenterStagingAuthConfig, constantTimeMatch, createSecurityCenterStagingAuth } = require('../security-agent/securityCenterStagingAuth');

const token = 's'.repeat(48);
const safeEnv = extra => ({
  NODE_ENV: 'production',
  SECURITY_CENTER_STAGING_AUTH_ENABLED: 'true',
  SECURITY_CENTER_STAGING_ADMIN_TOKEN: token,
  SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
  SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
  SECURITY_AGENT_STAGING_ID: 'demos-security-staging',
  SECURITY_AGENT_RUNTIME_MODE: 'memory',
  SECURITY_AGENT_STORE_ENABLED: 'false',
  SECURITY_RETENTION_JOB_ENABLED: 'false',
  SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'false',
  ...extra
});

function responseRecorder() {
  return { statusCode: 200, body: null, status(code){ this.statusCode=code; return this; }, json(body){ this.body=body; return this; } };
}

test('staging auth is disabled by default and exposes no secret', () => {
  const cfg = buildSecurityCenterStagingAuthConfig({ SECURITY_CENTER_STAGING_ADMIN_TOKEN: token });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.ready, false);
  assert.equal(JSON.stringify(cfg).includes(token), false);
});

test('staging auth requires hardened NODE_ENV, isolation and a strong token', () => {
  assert.deepEqual(buildSecurityCenterStagingAuthConfig(safeEnv()).blockers, []);
  assert.ok(buildSecurityCenterStagingAuthConfig(safeEnv({ NODE_ENV: 'development' })).blockers.includes('node_env_not_hardened'));
  assert.ok(buildSecurityCenterStagingAuthConfig(safeEnv({ SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'false' })).blockers.includes('staging_isolation_not_required'));
  assert.ok(buildSecurityCenterStagingAuthConfig(safeEnv({ SECURITY_CENTER_STAGING_ADMIN_TOKEN: 'short' })).blockers.includes('admin_token_too_short'));
});

test('constant-time matcher preserves exact token semantics', () => {
  assert.equal(constantTimeMatch(token, token), true);
  assert.equal(constantTimeMatch(token + 'x', token), false);
  assert.equal(constantTimeMatch('', token), false);
});

test('invalid bearer token is rejected without echoing either token', () => {
  const auth = createSecurityCenterStagingAuth(safeEnv());
  const req = { headers: { authorization: 'Bearer wrong-value' } };
  const res = responseRecorder();
  auth.verifyToken(req, res, () => assert.fail('next must not run'));
  assert.equal(res.statusCode, 401);
  const serialized = JSON.stringify(res.body);
  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes('wrong-value'), false);
});

test('valid bearer token creates only the synthetic staging admin identity', () => {
  const auth = createSecurityCenterStagingAuth(safeEnv());
  const req = { headers: { authorization: 'Bearer ' + token } };
  const res = responseRecorder();
  let verified = false;
  auth.verifyToken(req, res, () => { verified = true; });
  assert.equal(verified, true);
  assert.equal(req.userId, 'security-staging-validator');
  assert.equal(req.userRole, 'AD');
  let admin = false;
  auth.requireAdmin(req, res, () => { admin = true; });
  assert.equal(admin, true);
  assert.equal(JSON.stringify(req.user).includes(token), false);
  assert.equal(JSON.stringify(auth.config).includes(token), false);
});

test('staging auth factory fails closed on unsafe configuration', () => {
  assert.throws(() => createSecurityCenterStagingAuth(safeEnv({ SECURITY_AGENT_RUNTIME_MODE: 'postgres' })), /SECURITY_CENTER_STAGING_AUTH_BLOCKED/);
});

test('app selects staging auth without requiring production auth middleware', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const stagingAt = source.indexOf("SECURITY_CENTER_STAGING_AUTH_ENABLED === 'true'");
  const stagingRequireAt = source.indexOf("require('./security-agent/securityCenterStagingAuth')");
  const prodRequireAt = source.indexOf("require('./middleware/auth')", stagingAt);
  assert.ok(stagingAt >= 0 && stagingRequireAt > stagingAt && prodRequireAt > stagingRequireAt);
  assert.ok(source.includes('createSecurityCenterStagingAuth(process.env)'));
});
