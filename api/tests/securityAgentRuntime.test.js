const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSecurityAgentRuntimeConfig,
  SecurityAgentRuntime,
  createSecurityAgentRuntime
} = require('../security-agent/securityAgentRuntime');
const { runSecurityAgentWorker } = require('../security-agent/securityAgentWorker');

function readyEnv(overrides = {}) {
  return {
    SECURITY_AGENT_PROCESS_ENABLED: 'true',
    SECURITY_AGENT_SHADOW_ENABLED: 'true',
    SECURITY_AGENT_RUNNER_ENABLED: 'true',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_AGENT_RUNNER_INTERVAL_MS: '10000',
    ...overrides
  };
}

function fakeRunner(result = { status: 'ok' }) {
  let runs = 0;
  return {
    async runOnce() { runs += 1; return result; },
    status() { return { enabled: true, inFlight: false, lastRunStatus: runs ? result.status : 'never', runCount: runs, failureCount: 0 }; }
  };
}

test('runtime is disabled by default with explicit blockers', () => {
  const config = buildSecurityAgentRuntimeConfig({});
  assert.equal(config.ready, false);
  assert.deepEqual(config.blockers, ['process_disabled', 'source_disabled', 'runner_disabled']);
  assert.equal(config.mode, 'memory');
});

test('runtime requires all three enable flags', () => {
  const config = buildSecurityAgentRuntimeConfig({ SECURITY_AGENT_PROCESS_ENABLED: 'true' });
  assert.equal(config.ready, false);
  assert.deepEqual(config.blockers, ['source_disabled', 'runner_disabled']);
});

test('invalid runtime mode fails closed', () => {
  assert.throws(() => buildSecurityAgentRuntimeConfig(readyEnv({ SECURITY_AGENT_RUNTIME_MODE: 'root' })), /SECURITY_RUNTIME_MODE_INVALID/);
});

test('invalid interval fails closed', () => {
  assert.throws(() => buildSecurityAgentRuntimeConfig(readyEnv({ SECURITY_AGENT_RUNNER_INTERVAL_MS: '1000' })), /SECURITY_RUNTIME_INTERVAL_INVALID/);
});

test('memory mode is forbidden when production process is enabled', () => {
  assert.throws(() => buildSecurityAgentRuntimeConfig(readyEnv({ NODE_ENV: 'production' })), /SECURITY_RUNTIME_MEMORY_FORBIDDEN_IN_PRODUCTION/);
});

test('memory runtime becomes ready without database credential', () => {
  const runtime = createSecurityAgentRuntime({
    env: readyEnv(),
    sourceFactory: () => ({ poll() {}, checkHeartbeat() {}, status() {} }),
    runnerFactory: () => fakeRunner()
  });
  const status = runtime.status();
  assert.equal(status.state, 'ready');
  assert.equal(status.mode, 'memory');
  assert.equal(status.database.enabled, false);
  assert.equal(JSON.stringify(status).includes('password'), false);
});

test('postgres mode cannot bypass CP-008 credential gate', () => {
  assert.throws(() => createSecurityAgentRuntime({
    env: readyEnv({ SECURITY_AGENT_RUNTIME_MODE: 'postgres', SECURITY_AGENT_STORE_ENABLED: 'true' }),
    sourceFactory: () => ({}), runnerFactory: () => fakeRunner(), PoolCtor: function Pool() {}
  }), /SECURITY_RETENTION_POLICY_NOT_APPROVED/);
});

test('runtime start schedules cycles and stop closes resources', async () => {
  let ended = 0;
  const runner = fakeRunner();
  const config = buildSecurityAgentRuntimeConfig(readyEnv({ SECURITY_AGENT_RUN_IMMEDIATELY: 'true' }));
  const runtime = new SecurityAgentRuntime({ config, runner, resources: [{ async end() { ended += 1; } }] });
  assert.equal(runtime.start(), true);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(runtime.status().cycleCount >= 1);
  await runtime.stop();
  assert.equal(ended, 1);
  assert.equal(runtime.status().shutdownRequested, true);
});

test('runtime prevents duplicate starts', () => {
  const config = buildSecurityAgentRuntimeConfig(readyEnv());
  const runtime = new SecurityAgentRuntime({ config, runner: fakeRunner() });
  assert.equal(runtime.start(), true);
  assert.equal(runtime.start(), false);
  runtime.stop();
});

test('worker does not start when runtime is disabled and logs only safe state', async () => {
  const logs = [];
  const logger = { log(value) { logs.push(value); } };
  const worker = await runSecurityAgentWorker({
    env: {}, logger,
    runtimeFactory: ({ env }) => createSecurityAgentRuntime({ env })
  });
  assert.equal(worker.started, false);
  const joined = logs.join('\n');
  assert.match(joined, /not_started/);
  assert.doesNotMatch(joined, /DATABASE_URL|password|postgresql:\/\//i);
});

test('status exposes no secret-bearing runtime fields', () => {
  const config = buildSecurityAgentRuntimeConfig(readyEnv());
  const runtime = new SecurityAgentRuntime({ config, runner: fakeRunner(), credentialStatus: { enabled: true, purpose: 'writer', username: 'demos_security_agent_runtime', retentionDays: 30, poolConfig: { ssl: { rejectUnauthorized: true }, connectionString: 'postgresql://secret' } } });
  const serialized = JSON.stringify(runtime.status());
  assert.doesNotMatch(serialized, /connectionString|postgresql:\/\/secret/);
  assert.match(serialized, /demos_security_agent_runtime/);
});
