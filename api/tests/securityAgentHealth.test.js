const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSecurityAgentHealth } = require('../security-agent/securityAgentHealth');
const { buildSecurityAgentRuntimeConfig, SecurityAgentRuntime } = require('../security-agent/securityAgentRuntime');

function readyConfig() {
  return buildSecurityAgentRuntimeConfig({
    SECURITY_AGENT_PROCESS_ENABLED: 'true',
    SECURITY_AGENT_SHADOW_ENABLED: 'true',
    SECURITY_AGENT_RUNNER_ENABLED: 'true',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_AGENT_RUNNER_INTERVAL_MS: '10000'
  });
}

function runner(fn) {
  let runs = 0;
  let failures = 0;
  let last = 'never';
  return {
    async runOnce() {
      runs += 1;
      try {
        const result = await fn();
        last = result?.status || 'unknown';
        if (last === 'error' || last === 'degraded') failures += 1;
        return result;
      } catch (error) {
        last = 'error';
        failures += 1;
        throw error;
      }
    },
    status() {
      return { enabled: true, inFlight: false, lastRunStatus: last, runCount: runs, failureCount: failures };
    }
  };
}

test('disabled worker health is gray', () => {
  const health = buildSecurityAgentHealth({ state: 'disabled', intervalMs: 10000 });
  assert.equal(health.level, 'gray');
  assert.equal(health.operational, false);
});

test('successful runtime cycle is green', async () => {
  const runtime = new SecurityAgentRuntime({ config: readyConfig(), runner: runner(async () => ({ status: 'ok' })) });
  runtime.start();
  await runtime.runCycle();
  const health = runtime.health();
  assert.equal(health.level, 'green');
  assert.equal(runtime.status().consecutiveFailures, 0);
  assert.ok(runtime.status().lastSuccessAt);
  await runtime.stop();
});

test('Axiom-style source failure degrades health without leaking the cause', async () => {
  const runtime = new SecurityAgentRuntime({ config: readyConfig(), runner: runner(async () => ({ status: 'error', errorCode: 'UPSTREAM_SECRET_HOST' })) });
  await runtime.runCycle();
  const health = runtime.health();
  assert.equal(health.level, 'orange');
  assert.deepEqual(health.reasons, ['last_cycle_failed']);
  assert.doesNotMatch(JSON.stringify(health), /UPSTREAM_SECRET_HOST/);
});

test('upstream timeout is converted to a generic runtime failure', async () => {
  const runtime = new SecurityAgentRuntime({
    config: readyConfig(),
    runner: runner(async () => { throw new Error('ETIMEDOUT axiom.example secret-token'); })
  });
  const result = await runtime.runCycle();
  assert.deepEqual(result, { status: 'error', errorCode: 'SECURITY_RUNTIME_CYCLE_FAILED' });
  const serialized = JSON.stringify({ result, health: runtime.health() });
  assert.doesNotMatch(serialized, /axiom\.example|secret-token|ETIMEDOUT/);
  assert.equal(runtime.status().consecutiveFailures, 1);
});

test('three consecutive failures become critical', async () => {
  const runtime = new SecurityAgentRuntime({ config: readyConfig(), runner: runner(async () => ({ status: 'error' })) });
  await runtime.runCycle();
  await runtime.runCycle();
  await runtime.runCycle();
  const health = runtime.health();
  assert.equal(health.level, 'red');
  assert.ok(health.reasons.includes('repeated_failures'));
  assert.equal(runtime.status().totalFailures, 3);
});

test('successful cycle resets consecutive failure counter', async () => {
  let n = 0;
  const runtime = new SecurityAgentRuntime({ config: readyConfig(), runner: runner(async () => ({ status: ++n < 3 ? 'error' : 'ok' })) });
  runtime.start();
  await runtime.runCycle();
  await runtime.runCycle();
  assert.equal(runtime.status().consecutiveFailures, 2);
  await runtime.runCycle();
  assert.equal(runtime.status().consecutiveFailures, 0);
  assert.equal(runtime.health().level, 'green');
  await runtime.stop();
});

test('slow in-flight cycle is reported critical after stuck threshold', async () => {
  let resolveRun;
  const pending = new Promise(resolve => { resolveRun = resolve; });
  const runtime = new SecurityAgentRuntime({ config: readyConfig(), runner: runner(() => pending) });
  const cycle = runtime.runCycle();
  await new Promise(resolve => setTimeout(resolve, 20));
  const health = runtime.health({ stuckAfterMs: 10 });
  assert.equal(health.level, 'red');
  assert.ok(health.reasons.includes('cycle_stuck'));
  resolveRun({ status: 'ok' });
  await cycle;
});

test('shutdown waits for an in-flight cycle and closes resources', async () => {
  let resolveRun;
  let closed = false;
  const pending = new Promise(resolve => { resolveRun = resolve; });
  const runtime = new SecurityAgentRuntime({
    config: readyConfig(),
    runner: runner(() => pending),
    resources: [{ async end() { closed = true; } }]
  });
  const cycle = runtime.runCycle();
  await new Promise(resolve => setTimeout(resolve, 10));
  const stopping = runtime.stop({ timeoutMs: 200 });
  assert.equal(closed, false);
  setTimeout(() => resolveRun({ status: 'ok' }), 20);
  await stopping;
  await cycle;
  assert.equal(closed, true);
  assert.equal(runtime.status().shutdownRequested, true);
});

test('stale runtime without a successful cycle becomes degraded', () => {
  const health = buildSecurityAgentHealth({
    state: 'running',
    intervalMs: 10000,
    startedAt: '2026-10-03T10:00:00.000Z',
    lastSuccessAt: null,
    lastCycleStatus: 'never',
    consecutiveFailures: 0,
    inFlight: false
  }, {
    now: new Date('2026-10-03T10:01:01.000Z'),
    staleAfterMs: 60000
  });
  assert.equal(health.level, 'orange');
  assert.ok(health.reasons.includes('no_success'));
});

test('health output contains only bounded operational metadata', () => {
  const health = buildSecurityAgentHealth({
    state: 'running',
    intervalMs: 10000,
    startedAt: new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
    lastCycleStatus: 'ok',
    connectionString: 'postgresql://secret',
    token: 'very-secret'
  });
  const serialized = JSON.stringify(health);
  assert.doesNotMatch(serialized, /postgresql:\/\/secret|very-secret|connectionString|token/);
});
