const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAiAnalysisOrchestratorConfig, SecurityAiAnalysisOrchestrator } = require('../security-agent/securityAiAnalysisOrchestrator');
const { SecurityCenterService } = require('../security-agent/securityCenterService');

function integration() {
  return { status: () => ({ ready: true }), async analyze() { return { executable: false, toolCalls: [] }; } };
}
function incident(overrides = {}) {
  return { incidentId: 'SENSITIVE-ID', findingId: 'FIND-1', ruleId: 'DET-X', severity: 'high', status: 'open', count: 1,
    firstSeen: '2026-10-03T10:00:00Z', lastSeen: '2026-10-03T10:00:00Z', updatedAt: '2026-10-03T10:00:00Z', ...overrides };
}
function config(extra = {}) {
  return buildAiAnalysisOrchestratorConfig({ SECURITY_AI_ORCHESTRATOR_ENABLED: 'true', ...extra });
}
test('decision timeline is aggregate and identifier-free', async () => {
  const now = new Date('2026-10-03T10:00:00Z');
  const o = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: integration(), now: () => now });
  await o.analyzeCycle({ incidents: [incident()], now });
  const text = JSON.stringify(o.listDecisions({ limit: 10 }));
  assert.match(text, /analyzed/);
  assert.doesNotMatch(text, /SENSITIVE-ID|FIND-1|DET-X/);
});
test('counters record analyzed and deduplicated selections', async () => {
  let now = new Date('2026-10-03T10:00:00Z');
  const o = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: integration(), now: () => now });
  await o.analyzeCycle({ incidents: [incident()], now });
  now = new Date('2026-10-03T11:00:00Z');
  await o.analyzeCycle({ incidents: [incident()], now });
  const s = o.status();
  assert.equal(s.counters.analyzed, 1);
  assert.equal(s.counters.deduplicated, 1);
  assert.equal(s.decisionHistorySize, 2);
});
test('rate-limit decisions are counted without target data', async () => {
  let now = new Date('2026-10-03T10:00:00Z');
  const o = new SecurityAiAnalysisOrchestrator({ config: config({ SECURITY_AI_ORCHESTRATOR_MAX_ANALYSES_PER_HOUR: '1', SECURITY_AI_ORCHESTRATOR_COOLDOWN_MS: '60000' }), aiIntegration: integration(), now: () => now });
  await o.analyzeCycle({ incidents: [incident({ incidentId: 'A' })], now });
  now = new Date('2026-10-03T10:02:00Z');
  await o.analyzeCycle({ incidents: [incident({ incidentId: 'B', updatedAt: now.toISOString() })], now });
  assert.equal(o.status().counters.rateLimited, 1);
});
test('decision list validates bounds', () => {
  const o = new SecurityAiAnalysisOrchestrator({ config: config(), aiIntegration: integration() });
  assert.throws(() => o.listDecisions({ limit: 101 }), /invalid AI orchestrator decision limit/);
});
test('Security Center exposes orchestrator status and timeline read-only', async () => {
  const aiOrchestrator = { status: () => ({ ready: true, counters: { analyzed: 2 } }), listDecisions: ({ limit }) => [{ at: '2026-10-03T10:00:00Z', status: 'analyzed', selectedCount: Math.min(1, limit) }] };
  const store = { async listIncidents(){return [];}, async getSourceState(){return null;}, async stats(){return {incidentCount:0};} };
  const service = new SecurityCenterService({ runner: { status: () => ({ enabled: false }) }, store, aiOrchestrator });
  const data = await service.getAiOrchestrator({ limit: 5 });
  assert.equal(data.status.counters.analyzed, 2);
  assert.equal(data.decisions.length, 1);
});
