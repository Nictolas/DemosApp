const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAiAnalystRequest } = require('../security-agent/securityAiAnalystContract');
const { buildModelGatewayConfig, SecurityAiModelGateway } = require('../security-agent/securityAiModelGateway');
const {
  buildGroqSecurityProviderConfig,
  SecurityAiGroqProvider,
  createGroqSecurityAiProvider
} = require('../security-agent/securityAiGroqProvider');
const { createSecurityAiShadowIntegration } = require('../security-agent/securityAiShadowIntegration');
const { createAxiomReadOnlySecuritySource } = require('../security-agent/readOnlySecuritySource');

function env(overrides = {}) {
  return {
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
    SECURITY_AI_TIMEOUT_MS: '1000',
    SECURITY_AI_MAX_REQUEST_COST_MICROS: '100',
    SECURITY_AI_DAILY_COST_BUDGET_MICROS: '300',
    SECURITY_AI_MAX_DAILY_REQUESTS: '3',
    SECURITY_AI_GROQ_REQUEST_COST_ESTIMATE_MICROS: '50',
    SECURITY_AI_GROQ_MAX_TOKENS: '600',
    GROQ_API_KEY: `gsk_${'A'.repeat(32)}`,
    ...overrides
  };
}

function validOutput() {
  return JSON.stringify({
    assessment: 'suspicious', confidence: 88, prioritySuggestion: 'P1', summary: 'Correlated high-risk signal.',
    hypotheses: [{ code: 'correlated_high_risk_signal', confidence: 88 }],
    recommendedActions: ['investigate', 'escalate_human'], requiresHumanReview: true
  });
}

function fakeClient({ output = validOutput(), fail = false } = {}) {
  const calls = [];
  return {
    calls,
    chat: { completions: { async create(payload) {
      calls.push(payload);
      if (fail) throw new Error('secret provider detail');
      return { choices: [{ message: { content: output } }] };
    } } }
  };
}

test('Groq security provider is fail-closed without an external key/cost estimate', () => {
  const c = buildGroqSecurityProviderConfig({ SECURITY_AI_PROVIDER:'groq', SECURITY_AI_REGION:'global', SECURITY_AI_MODEL:'m' });
  assert.equal(c.ready, false);
  assert.ok(c.blockers.includes('api_key_missing'));
  assert.ok(c.blockers.includes('cost_estimate_missing'));
  assert.equal(JSON.stringify(c).includes('gsk_'), false);
});

test('Groq adapter sends only sanitized shadow evidence and no tool definition', async () => {
  const e = env();
  const client = fakeClient();
  const adapter = createGroqSecurityAiProvider({ env: e, client });
  const request = buildAiAnalystRequest({
    incidents: [{ incidentId:'i-1', ruleId:'DET-TEST', severity:'high', status:'open', count:2, rawLog:'SECRET_RAW_LOG', userEmail:'private@example.test' }]
  });
  const result = await adapter.analyze(request);
  assert.equal(client.calls.length, 1);
  const sent = client.calls[0];
  assert.equal(sent.model, e.SECURITY_AI_MODEL);
  assert.equal(sent.temperature, 0);
  assert.deepEqual(sent.response_format, { type:'json_object' });
  assert.equal(Object.prototype.hasOwnProperty.call(sent, 'tools'), false);
  const serialized = JSON.stringify(sent);
  assert.equal(serialized.includes('SECRET_RAW_LOG'), false);
  assert.equal(serialized.includes('private@example.test'), false);
  assert.match(sent.messages[0].content, /shadow\/read-only/i);
  assert.equal(result.costMicros, 50);
});

test('Groq adapter refuses unsafe or tool-bearing requests before provider transport', async () => {
  const e = env();
  const client = fakeClient();
  const adapter = createGroqSecurityAiProvider({ env: e, client });
  await assert.rejects(() => adapter.analyze({ mode:'active', input:{controls:{}}, tools:[] }), /AI_GROQ_REQUEST_UNSAFE/);
  await assert.rejects(() => adapter.analyze({ mode:'shadow', input:{controls:{readOnly:true,toolAccess:false,writeAccess:false,secretsAccess:false,rawLogsAccess:false}}, tools:[{name:'x'}] }), /AI_GROQ_TOOLS_FORBIDDEN/);
  assert.equal(client.calls.length, 0);
});

test('Groq provider transport failures expose only a generic code', async () => {
  const e = env();
  const adapter = createGroqSecurityAiProvider({ env:e, client:fakeClient({fail:true}) });
  await assert.rejects(() => adapter.analyze(buildAiAnalystRequest({})), /^Error: AI_GROQ_PROVIDER_FAILED$/);
});

test('model gateway validates Groq JSON and still returns non-executable output', async () => {
  const e = env();
  const adapter = createGroqSecurityAiProvider({ env:e, client:fakeClient() });
  const gateway = new SecurityAiModelGateway({ config:buildModelGatewayConfig(e), providerAdapter:adapter });
  const out = await gateway.analyze({ incidents:[{incidentId:'i-1',severity:'high',status:'open'}] });
  assert.equal(out.executable, false);
  assert.deepEqual(out.toolCalls, []);
  assert.equal(out.gateway.provider, 'groq');
  assert.equal(out.gateway.simulated, false);
});

test('shadow integration factory can wire an explicitly approved gateway adapter without enabling execution', () => {
  const e = env();
  const adapter = createGroqSecurityAiProvider({ env:e, client:fakeClient() });
  const integration = createSecurityAiShadowIntegration({ env:e, providerAdapter:adapter });
  const s = integration.status();
  assert.equal(s.ready, true);
  assert.equal(s.backend, 'gateway');
  assert.equal(s.policy.executable, false);
  assert.equal(s.policy.actionRunnerAvailable, false);
  assert.equal(s.approvalGate.actionRunnerAvailable, false);
});

test('Axiom source readiness path remains query-only and disabled unless explicitly enabled', async () => {
  let calls = 0;
  let args = null;
  const source = createAxiomReadOnlySecuritySource({
    env: { SECURITY_AGENT_SHADOW_ENABLED:'true', NODE_ENV:'staging' },
    fetchSecurityEvents: async value => { calls += 1; args = value; return []; }
  });
  const result = await source.poll({ now:new Date('2026-10-06T10:00:00Z') });
  assert.equal(result.status, 'ok');
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(args).sort(), ['endTime','limit','startTime']);

  const disabled = createAxiomReadOnlySecuritySource({ env:{}, fetchSecurityEvents:async()=>{ throw new Error('must not call'); } });
  assert.equal((await disabled.poll()).status, 'disabled');
});
