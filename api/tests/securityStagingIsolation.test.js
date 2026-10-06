const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSecurityStagingIsolationConfig,
  assertSecurityStagingIsolation
} = require('../security-agent/securityStagingIsolation');
const {
  buildSecurityAgentRuntimeConfig,
  SecurityAgentRuntime
} = require('../security-agent/securityAgentRuntime');

function stagingEnv(overrides = {}) {
  return {
    SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_STAGING_ID: 'demos-security-staging',
    SECURITY_AGENT_PROCESS_ENABLED: 'true',
    SECURITY_AGENT_SHADOW_ENABLED: 'true',
    SECURITY_AGENT_RUNNER_ENABLED: 'true',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_AGENT_RUNNER_INTERVAL_MS: '10000',
    SECURITY_AGENT_STORE_ENABLED: 'false',
    SECURITY_RETENTION_JOB_ENABLED: 'false',
    SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'false',
    AXIOM_ENABLED: 'true',
    AXIOM_REALTIME_DATASET: 'demos-security-staging',
    ...overrides
  };
}

function gatewayEnv(overrides = {}) {
  return stagingEnv({
    SECURITY_AI_SHADOW_INTEGRATION_ENABLED: 'true',
    SECURITY_AI_SHADOW_BACKEND: 'gateway',
    SECURITY_AI_MODEL_GATEWAY_ENABLED: 'true',
    SECURITY_AI_PROVIDER_POLICY_APPROVED: 'true',
    SECURITY_AI_PROVIDER: 'groq',
    SECURITY_AI_REGION: 'global',
    SECURITY_AI_MODEL: 'llama-3.3-70b-versatile',
    SECURITY_AI_PROVIDER_ALLOWLIST: 'groq',
    SECURITY_AI_REGION_ALLOWLIST: 'global',
    SECURITY_AI_MODEL_ALLOWLIST: 'llama-3.3-70b-versatile',
    SECURITY_AI_TIMEOUT_MS: '8000',
    SECURITY_AI_MAX_REQUEST_COST_MICROS: '100',
    SECURITY_AI_DAILY_COST_BUDGET_MICROS: '1000',
    SECURITY_AI_MAX_DAILY_REQUESTS: '10',
    SECURITY_AI_GROQ_REQUEST_COST_ESTIMATE_MICROS: '100',
    GROQ_API_KEY: '[REDACTED_GROQ_API_KEY]',
    ...overrides
  });
}

function fakeRunner() {
  return {
    status() { return { enabled: true, inFlight: false, lastRunStatus: 'never', runCount: 0, failureCount: 0 }; },
    async runOnce() { return { status: 'ok' }; }
  };
}

test('isolation is opt-in and does not alter existing disabled environments', () => {
  const c = buildSecurityStagingIsolationConfig({});
  assert.equal(c.required, false);
  assert.equal(c.ready, true);
  assert.deepEqual(c.blockers, []);
  assert.equal(c.actionRunnerAvailable, false);
  assert.equal(c.databaseWriterAllowed, false);
});

test('telemetry-only non-production staging profile is accepted', () => {
  const c = buildSecurityStagingIsolationConfig(stagingEnv());
  assert.equal(c.required, true);
  assert.equal(c.ready, true);
  assert.equal(c.environmentClass, 'staging');
  assert.equal(c.runtimeMode, 'memory');
  assert.equal(c.axiom.isolatedDataset, true);
});

test('production/default Axiom dataset cannot be inherited by staging', () => {
  const realTime = buildSecurityStagingIsolationConfig(stagingEnv({ AXIOM_REALTIME_DATASET: 'real-time' }));
  assert.equal(realTime.ready, false);
  assert.ok(realTime.blockers.includes('axiom_dataset_not_isolated'));

  const prod = buildSecurityStagingIsolationConfig(stagingEnv({ AXIOM_REALTIME_DATASET: 'demos-security-prod' }));
  assert.equal(prod.ready, false);
  assert.ok(prod.blockers.includes('axiom_dataset_not_isolated'));
});

test('writer, retention and action runner capabilities are forbidden in isolated staging', () => {
  const c = buildSecurityStagingIsolationConfig(stagingEnv({
    SECURITY_AGENT_STORE_ENABLED: 'true',
    SECURITY_RETENTION_JOB_ENABLED: 'true',
    SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'true'
  }));
  assert.equal(c.ready, false);
  assert.ok(c.blockers.includes('database_writer_forbidden'));
  assert.ok(c.blockers.includes('retention_writer_forbidden'));
  assert.ok(c.blockers.includes('action_runner_forbidden'));
});

test('staging identity must be explicit and cannot contain a production marker', () => {
  const wrongClass = buildSecurityStagingIsolationConfig(stagingEnv({ SECURITY_AGENT_ENVIRONMENT_CLASS: 'production' }));
  assert.ok(wrongClass.blockers.includes('environment_class_not_staging'));

  const prodId = buildSecurityStagingIsolationConfig(stagingEnv({ SECURITY_AGENT_STAGING_ID: 'demos-security-prod' }));
  assert.ok(prodId.blockers.includes('staging_id_production_marker'));
});

test('real AI gateway is accepted only with explicit policy, allowlists, budgets and provider credential', () => {
  const missing = buildSecurityStagingIsolationConfig(gatewayEnv({
    SECURITY_AI_PROVIDER_POLICY_APPROVED: 'false',
    GROQ_API_KEY: ''
  }));
  assert.equal(missing.ready, false);
  assert.ok(missing.blockers.includes('ai_gateway_not_ready'));
  assert.ok(missing.blockers.includes('ai_provider_not_ready'));

  const ready = buildSecurityStagingIsolationConfig(gatewayEnv());
  assert.equal(ready.ready, true);
  assert.equal(ready.ai.backend, 'gateway');
  assert.equal(ready.ai.policyApproved, true);
});

test('Render-style NODE_ENV=production may use memory only behind a passing staging isolation gate', () => {
  const isolated = buildSecurityAgentRuntimeConfig(stagingEnv({ NODE_ENV: 'production' }));
  assert.equal(isolated.ready, true);
  assert.equal(isolated.stagingIsolation.ready, true);

  assert.throws(() => buildSecurityAgentRuntimeConfig({
    SECURITY_AGENT_PROCESS_ENABLED: 'true',
    SECURITY_AGENT_SHADOW_ENABLED: 'true',
    SECURITY_AGENT_RUNNER_ENABLED: 'true',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    NODE_ENV: 'production'
  }), /SECURITY_RUNTIME_MEMORY_FORBIDDEN_IN_PRODUCTION/);
});

test('runtime refuses an isolation-required configuration with production-like inputs', () => {
  const config = buildSecurityAgentRuntimeConfig(stagingEnv({ AXIOM_REALTIME_DATASET: 'real-time' }));
  assert.equal(config.ready, false);
  assert.ok(config.blockers.includes('staging:axiom_dataset_not_isolated'));
});

test('public runtime status never exposes provider credentials', () => {
  const secret = '[REDACTED_GROQ_API_KEY]';
  const config = buildSecurityAgentRuntimeConfig(gatewayEnv({ GROQ_API_KEY: secret }));
  const runtime = new SecurityAgentRuntime({ config, runner: fakeRunner() });
  const serialized = JSON.stringify(runtime.status());
  assert.equal(serialized.includes(secret), false);
  assert.equal(runtime.status().stagingIsolation.actionRunnerAvailable, false);
  assert.equal(runtime.status().stagingIsolation.databaseWriterAllowed, false);
});

test('assertion fails closed with generic staging code', () => {
  assert.throws(
    () => assertSecurityStagingIsolation(stagingEnv({ SECURITY_AGENT_RUNTIME_MODE: 'postgres' })),
    error => error?.code === 'SECURITY_STAGING_ISOLATION_BLOCKED' && Array.isArray(error.blockers)
  );
});
