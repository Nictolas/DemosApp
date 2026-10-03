const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAiShadowIntegrationConfig,
  SecurityAiShadowIntegration
} = require('../security-agent/securityAiShadowIntegration');

const valid = overrides => ({
  executable: false,
  toolCalls: [],
  assessment: 'suspicious',
  confidence: 80,
  prioritySuggestion: 'P1',
  summary: 'simulated analysis',
  hypotheses: [],
  recommendedActions: ['investigate'],
  requiresHumanReview: true,
  ...overrides
});

function target({ ready = true, output = valid(), fail = false, statusExtra = {} } = {}) {
  let calls = 0;
  return {
    calls: () => calls,
    status() { return { version: 'x', state: ready ? 'ready' : 'blocked', ready, simulated: true, provider: 'fake', ...statusExtra }; },
    async analyze() { calls += 1; if (fail) throw new Error('secret provider detail'); return output; }
  };
}

function env(overrides = {}) {
  return { SECURITY_AI_SHADOW_INTEGRATION_ENABLED: 'true', SECURITY_AI_SHADOW_BACKEND: 'mock', ...overrides };
}

test('integration is disabled by default', () => {
  const c = buildAiShadowIntegrationConfig({});
  assert.equal(c.enabled, false); assert.equal(c.ready, false); assert.ok(c.blockers.includes('integration_disabled'));
});

test('backend must be allowlisted', () => {
  const c = buildAiShadowIntegrationConfig(env({ SECURITY_AI_SHADOW_BACKEND: 'real_auto' }));
  assert.equal(c.ready, false); assert.ok(c.blockers.includes('backend_not_allowlisted'));
});

test('disabled integration never calls target', async () => {
  const mock = target();
  const i = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig({}), mockRunner: mock });
  await assert.rejects(() => i.analyze({}), /AI_SHADOW_INTEGRATION_NOT_READY/);
  assert.equal(mock.calls(), 0);
});

test('mock backend stores only normalized non-executable analysis', async () => {
  const mock = target({ output: valid({ summary: '<b>safe</b>\ntext', rawLog: 'SECRET' }) });
  const i = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig(env()), mockRunner: mock, now: () => new Date('2026-10-03T15:00:00Z') });
  const out = await i.analyze({ rawLog: 'SECRET' });
  assert.equal(out.backend, 'mock'); assert.equal(out.executable, false); assert.deepEqual(out.toolCalls, []);
  assert.equal(JSON.stringify(out).includes('SECRET'), false); assert.equal(out.summary, 'bsafe/b text');
  assert.equal(i.listRecent({ limit: 1 }).length, 1);
});

test('gateway backend refuses an unready gateway before analyze', async () => {
  const gateway = target({ ready: false });
  const i = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig(env({ SECURITY_AI_SHADOW_BACKEND: 'gateway' })), modelGateway: gateway });
  await assert.rejects(() => i.analyze({}), /AI_SHADOW_TARGET_NOT_READY/);
  assert.equal(gateway.calls(), 0);
});

test('gateway backend can pass a validated simulated result', async () => {
  const gateway = target({ ready: true, statusExtra: { region: 'eu-test', model: 'mock-1' } });
  const i = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig(env({ SECURITY_AI_SHADOW_BACKEND: 'gateway' })), modelGateway: gateway });
  const out = await i.analyze({});
  assert.equal(out.backend, 'gateway'); assert.equal(out.executable, false); assert.equal(i.status().ready, true);
  assert.equal(i.status().target.region, 'eu-test');
});

test('provider errors are mapped to generic integration codes', async () => {
  const mock = target({ fail: true });
  const i = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig(env()), mockRunner: mock });
  await assert.rejects(() => i.analyze({}), /AI_SHADOW_MOCK_FAILED/);
  assert.equal(i.status().lastErrorCode, 'AI_SHADOW_MOCK_FAILED');
  assert.equal(JSON.stringify(i.status()).includes('secret provider detail'), false);
});

test('executable outputs and tool calls are rejected', async () => {
  const mock1 = target({ output: valid({ executable: true }) });
  const i1 = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig(env()), mockRunner: mock1 });
  await assert.rejects(() => i1.analyze({}), /AI_SHADOW_OUTPUT_INVALID/);
  const mock2 = target({ output: valid({ toolCalls: [{ name: 'delete' }] }) });
  const i2 = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig(env()), mockRunner: mock2 });
  await assert.rejects(() => i2.analyze({}), /AI_SHADOW_OUTPUT_INVALID/);
});

test('status/listRecent satisfy Security Center read contract', async () => {
  const mock = target();
  const i = new SecurityAiShadowIntegration({ config: buildAiShadowIntegrationConfig(env()), mockRunner: mock });
  await i.analyze({});
  assert.equal(typeof i.status, 'function'); assert.equal(typeof i.listRecent, 'function');
  assert.equal(i.status().state, 'ready'); assert.equal(i.listRecent({ limit: 10 }).length, 1);
});
