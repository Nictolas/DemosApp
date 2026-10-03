const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAiAnalysisOrchestratorConfig,
  SecurityAiAnalysisOrchestrator,
  ShadowSecurityRunner,
  MemorySecurityStore
} = require('../security-agent');

function config(overrides = {}) {
  return buildAiAnalysisOrchestratorConfig({ SECURITY_AI_ORCHESTRATOR_ENABLED: 'true', ...overrides });
}
function integration(overrides = {}) {
  let calls = 0;
  return {
    calls: () => calls,
    status: () => ({ ready: true }),
    async analyze(input) { calls += 1; return input; },
    ...overrides
  };
}
function incident(overrides = {}) {
  return {
    incidentId: 'inc-1', findingId: 'DET-X:1', ruleId: 'DET-X', severity: 'high', status: 'open', count: 1,
    firstSeen: '2026-10-03T10:00:00.000Z', lastSeen: '2026-10-03T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z',
    ...overrides
  };
}

test('orchestrator is OFF by default', () => {
  const cfg = buildAiAnalysisOrchestratorConfig({});
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.ready, false);
});

test('invalid severity policy blocks enabled orchestrator', () => {
  assert.equal(config({ SECURITY_AI_ORCHESTRATOR_MIN_SEVERITY: 'invalid' }).ready, false);
});

test('disabled orchestrator performs zero AI calls', async () => {
  const ai = integration();
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: buildAiAnalysisOrchestratorConfig({}), aiIntegration: ai });
  assert.equal((await orchestrator.analyzeCycle({ incidents: [incident()] })).status, 'skipped_disabled');
  assert.equal(ai.calls(), 0);
});

test('not-ready shadow integration is never called', async () => {
  const ai = integration({ status: () => ({ ready: false }) });
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai });
  assert.equal((await orchestrator.analyzeCycle({ incidents: [incident()] })).status, 'skipped_target_not_ready');
});

test('default policy analyzes only open high/critical incidents', async () => {
  const ai = integration();
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai });
  const result = await orchestrator.analyzeCycle({ incidents: [incident({ severity: 'medium' }), incident({ incidentId: 'closed', status: 'resolved' })] });
  assert.equal(result.status, 'skipped_no_eligible_incidents');
  assert.equal(result.belowThresholdCount, 1);
  assert.equal(result.closedCount, 1);
});

test('eligible incident is analyzed once', async () => {
  const ai = integration();
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai });
  const result = await orchestrator.analyzeCycle({ incidents: [incident()] });
  assert.equal(result.status, 'analyzed');
  assert.equal(result.selectedCount, 1);
  assert.equal(ai.calls(), 1);
});

test('unchanged incident is deduplicated even after cooldown', async () => {
  const ai = integration();
  let now = new Date('2026-10-03T10:00:00Z');
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai, now: () => now });
  await orchestrator.analyzeCycle({ incidents: [incident()], now });
  now = new Date('2026-10-03T11:00:00Z');
  const result = await orchestrator.analyzeCycle({ incidents: [incident()], now });
  assert.equal(result.duplicateCount, 1);
  assert.equal(ai.calls(), 1);
});

test('changed incident respects cooldown', async () => {
  const ai = integration();
  let now = new Date('2026-10-03T10:00:00Z');
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai, now: () => now });
  await orchestrator.analyzeCycle({ incidents: [incident()], now });
  now = new Date('2026-10-03T10:05:00Z');
  const result = await orchestrator.analyzeCycle({ incidents: [incident({ count: 2, updatedAt: now.toISOString() })], now });
  assert.equal(result.cooldownCount, 1);
  assert.equal(ai.calls(), 1);
});

test('severity escalation bypasses cooldown', async () => {
  const ai = integration();
  let now = new Date('2026-10-03T10:00:00Z');
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai, now: () => now });
  await orchestrator.analyzeCycle({ incidents: [incident()], now });
  now = new Date('2026-10-03T10:05:00Z');
  const result = await orchestrator.analyzeCycle({ incidents: [incident({ severity: 'critical', count: 2, updatedAt: now.toISOString() })], now });
  assert.equal(result.status, 'analyzed');
  assert.equal(ai.calls(), 2);
});

test('changed incident can be re-analyzed after cooldown', async () => {
  const ai = integration();
  let now = new Date('2026-10-03T10:00:00Z');
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai, now: () => now });
  await orchestrator.analyzeCycle({ incidents: [incident()], now });
  now = new Date('2026-10-03T10:20:00Z');
  assert.equal((await orchestrator.analyzeCycle({ incidents: [incident({ count: 2, updatedAt: now.toISOString() })], now })).status, 'analyzed');
});

test('incident batch size is bounded', async () => {
  let received = 0;
  const ai = integration({ async analyze(input) { received = input.incidents.length; } });
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config({ SECURITY_AI_ORCHESTRATOR_MAX_INCIDENTS: '2' }), aiIntegration: ai });
  const result = await orchestrator.analyzeCycle({ incidents: [incident({ incidentId: '1' }), incident({ incidentId: '2' }), incident({ incidentId: '3' })] });
  assert.equal(result.selectedCount, 2);
  assert.equal(received, 2);
});

test('hourly analysis cap is enforced before target call', async () => {
  const ai = integration();
  let now = new Date('2026-10-03T10:00:00Z');
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config({ SECURITY_AI_ORCHESTRATOR_MAX_ANALYSES_PER_HOUR: '1', SECURITY_AI_ORCHESTRATOR_COOLDOWN_MS: '60000' }), aiIntegration: ai, now: () => now });
  await orchestrator.analyzeCycle({ incidents: [incident({ incidentId: '1' })], now });
  now = new Date('2026-10-03T10:02:00Z');
  assert.equal((await orchestrator.analyzeCycle({ incidents: [incident({ incidentId: '2' })], now })).status, 'skipped_rate_limit');
  assert.equal(ai.calls(), 1);
});

test('AI failure is generic and retry is cooled down', async () => {
  let calls = 0;
  const ai = integration({ async analyze() { calls += 1; throw new Error('token=SECRET'); } });
  let now = new Date('2026-10-03T10:00:00Z');
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai, now: () => now });
  const first = await orchestrator.analyzeCycle({ incidents: [incident()], now });
  assert.equal(first.errorCode, 'AI_ORCHESTRATOR_ANALYSIS_FAILED');
  now = new Date('2026-10-03T10:01:00Z');
  const second = await orchestrator.analyzeCycle({ incidents: [incident()], now });
  assert.equal(second.cooldownCount, 1);
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(first), /SECRET|token=/);
});

test('orchestrator status never exposes incident identifiers', async () => {
  const ai = integration();
  const orchestrator = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: ai });
  await orchestrator.analyzeCycle({ incidents: [incident({ incidentId: 'SECRET-INCIDENT-ID' })] });
  assert.doesNotMatch(JSON.stringify(orchestrator.status()), /SECRET-INCIDENT-ID/);
});

test('shadow runner feeds detected incidents to orchestrator and exposes only summary', async () => {
  const store = new MemorySecurityStore();
  let received = null;
  const aiOrchestrator = {
    status: () => ({ ready: true }),
    async analyzeCycle(input) { received = input.incidents; return { status: 'analyzed', selectedCount: 1, eligibleCount: 1, secret: 'never expose' }; }
  };
  const source = {
    pipeline: { snapshot: () => ({ incidents: [incident()] }) },
    poll: async () => ({ status: 'ok', fetched: 1, accepted: 1, duplicates: 0 }),
    checkHeartbeat: async () => ({ status: 'healthy', incidentCreated: false }),
    status: () => ({ enabled: true, totals: {} })
  };
  const runner = new ShadowSecurityRunner({ source, store, aiOrchestrator, enabled: true });
  const result = await runner.runOnce({ now: new Date('2026-10-03T12:00:00Z') });
  assert.equal(received.length, 1);
  assert.equal(result.aiAnalysis.status, 'analyzed');
  assert.equal(result.aiAnalysis.selectedCount, 1);
  assert.doesNotMatch(JSON.stringify(result.aiAnalysis), /never expose|secret/);
});