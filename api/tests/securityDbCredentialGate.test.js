const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PURPOSES,
  buildSecurityDbClientConfig,
  createPoolForPurpose,
  publicCredentialStatus,
  parseRetentionDays
} = require('../security-agent/securityDbCredentialGate');

const secret = 'A'.repeat(32);
const url = (user, password = secret, extra = '') =>
  `postgresql://${user}:${password}@db.example.supabase.co:5432/postgres${extra}`;
const approved = extra => ({
  SECURITY_STORE_POLICY_APPROVED: 'true',
  SECURITY_STORE_RETENTION_DAYS: '90',
  ...(extra || {})
});

test('credential purposes are OFF by default', () => {
  for (const purpose of Object.keys(PURPOSES)) {
    assert.deepEqual(buildSecurityDbClientConfig({ env: {}, purpose }), { enabled: false, purpose });
  }
});

test('writer fails closed until retention policy is approved', () => {
  const env = {
    SECURITY_AGENT_STORE_ENABLED: 'true',
    SECURITY_AGENT_DATABASE_URL: url('demos_security_agent_runtime')
  };
  assert.throws(() => buildSecurityDbClientConfig({ env, purpose: 'writer' }),
    error => error.code === 'SECURITY_RETENTION_POLICY_NOT_APPROVED' && !/A{10}/.test(error.message));
});

test('writer accepts only expected low privilege login and forces verified TLS', () => {
  const config = buildSecurityDbClientConfig({ purpose: 'writer', env: approved({
    SECURITY_AGENT_STORE_ENABLED: 'true',
    SECURITY_AGENT_DATABASE_URL: url('demos_security_agent_runtime', secret, '?sslmode=disable&foo=bar')
  }) });
  assert.equal(config.username, 'demos_security_agent_runtime');
  assert.equal(config.poolConfig.ssl.rejectUnauthorized, true);
  assert.doesNotMatch(config.poolConfig.connectionString, /sslmode/i);
  assert.match(config.poolConfig.connectionString, /foo=bar/);
});

test('privileged and mismatched database roles are rejected', () => {
  for (const user of ['postgres', 'service_role', 'supabase_admin']) {
    assert.throws(() => buildSecurityDbClientConfig({ purpose: 'writer', env: approved({
      SECURITY_AGENT_STORE_ENABLED: 'true', SECURITY_AGENT_DATABASE_URL: url(user)
    }) }), error => ['SECURITY_DATABASE_ROLE_FORBIDDEN', 'SECURITY_DATABASE_ROLE_MISMATCH'].includes(error.code)
      && !error.message.includes(secret));
  }
  assert.throws(() => buildSecurityDbClientConfig({ purpose: 'writer', env: approved({
    SECURITY_AGENT_STORE_ENABLED: 'true',
    SECURITY_AGENT_DATABASE_URL: url('demos_security_center_runtime')
  }) }), error => error.code === 'SECURITY_DATABASE_ROLE_MISMATCH');
});

test('reader and maintenance require distinct expected logins', () => {
  const reader = buildSecurityDbClientConfig({ purpose: 'reader', env: approved({
    SECURITY_CENTER_STORE_ENABLED: 'true',
    SECURITY_CENTER_DATABASE_URL: url('demos_security_center_runtime')
  }) });
  const maintenance = buildSecurityDbClientConfig({ purpose: 'maintenance', env: approved({
    SECURITY_RETENTION_JOB_ENABLED: 'true',
    SECURITY_RETENTION_DATABASE_URL: url('demos_security_retention_runtime')
  }) });
  assert.equal(reader.username, 'demos_security_center_runtime');
  assert.equal(maintenance.username, 'demos_security_retention_runtime');
  assert.notEqual(reader.username, maintenance.username);
});

test('short passwords and non postgres URLs are rejected without leaks', () => {
  assert.throws(() => buildSecurityDbClientConfig({ purpose: 'reader', env: approved({
    SECURITY_CENTER_STORE_ENABLED: 'true',
    SECURITY_CENTER_DATABASE_URL: url('demos_security_center_runtime', 'tiny')
  }) }), error => error.code === 'SECURITY_DATABASE_CREDENTIAL_INVALID' && !error.message.includes('tiny'));
  assert.throws(() => buildSecurityDbClientConfig({ purpose: 'reader', env: approved({
    SECURITY_CENTER_STORE_ENABLED: 'true',
    SECURITY_CENTER_DATABASE_URL: `https://demos_security_center_runtime:${secret}@example.test/x`
  }) }), error => error.code === 'SECURITY_DATABASE_CREDENTIAL_INVALID');
});

test('public credential status never exposes connection secrets', () => {
  const config = buildSecurityDbClientConfig({ purpose: 'writer', env: approved({
    SECURITY_AGENT_STORE_ENABLED: 'true',
    SECURITY_AGENT_DATABASE_URL: url('demos_security_agent_runtime')
  }) });
  const status = publicCredentialStatus(config);
  assert.deepEqual(Object.keys(status), ['enabled', 'purpose', 'configured', 'role', 'retentionDays', 'tlsVerified']);
  assert.doesNotMatch(JSON.stringify(status), /supabase|postgresql|A{10}|connectionString/);
});

test('pool factory creates only requested purpose with hard TLS', () => {
  const configs = [];
  class FakePool { constructor(config) { configs.push(config); } }
  const result = createPoolForPurpose({ purpose: 'reader', PoolCtor: FakePool, env: approved({
    SECURITY_CENTER_STORE_ENABLED: 'true',
    SECURITY_CENTER_DATABASE_URL: url('demos_security_center_runtime')
  }) });
  assert.equal(result.enabled, true);
  assert.equal(configs.length, 1);
  assert.equal(configs[0].application_name, 'demos-security-center-reader');
  assert.equal(configs[0].ssl.rejectUnauthorized, true);
  assert.doesNotMatch(JSON.stringify(result.status), /A{10}|db\.example/);
});

test('disabled purpose creates no pool and requires no policy values', () => {
  let calls = 0;
  class FakePool { constructor() { calls += 1; } }
  const result = createPoolForPurpose({ purpose: 'maintenance', PoolCtor: FakePool, env: {} });
  assert.equal(result.enabled, false);
  assert.equal(result.pool, null);
  assert.equal(calls, 0);
});

test('retention days are explicit and bounded', () => {
  assert.equal(parseRetentionDays('90'), 90);
  for (const value of [undefined, '', '0', '-1', '1.5', '3651']) {
    assert.throws(() => parseRetentionDays(value), error => error.code === 'SECURITY_RETENTION_POLICY_INVALID');
  }
});
