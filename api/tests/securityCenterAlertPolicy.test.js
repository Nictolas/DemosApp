const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSecurityAlerts } = require('../security-agent/securityAlertPolicy');
const { buildSecurityCenterOverview } = require('../security-agent/securityCenterReadModel');
const { SecurityCenterService } = require('../security-agent/securityCenterService');

const now = new Date('2026-10-03T13:00:00.000Z');
const runner = extra => ({ enabled: true, running: true, inFlight: false, intervalMs: 60000, lastRunAt: '2026-10-03T12:59:30.000Z', lastRunStatus: 'ok', runCount: 5, failureCount: 0, ...extra });
const runtime = extra => ({ state: 'running', intervalMs: 60000, startedAt: '2026-10-03T12:50:00.000Z', lastCycleStatus: 'ok', lastSuccessAt: '2026-10-03T12:59:30.000Z', consecutiveFailures: 0, inFlight: false, inFlightStartedAt: null, ...extra });
const source = extra => ({ enabled: true, lastSuccessAt: '2026-10-03T12:59:30.000Z', lastFailureAt: null, consecutiveFailures: 0, totals: { polls: 5, fetched: 20, accepted: 18, duplicates: 2 }, ...extra });
const incident = extra => ({ incidentId: 'inc-1', findingId: 'find-1', ruleId: 'DET-X', severity: 'medium', status: 'open', count: 1, updatedAt: '2026-10-03T12:59:00.000Z', ...extra });

function overview({ runtimeStatus = runtime(), runnerStatus = runner(), sourceState = source(), incidents = [] } = {}) {
  return buildSecurityCenterOverview({ runtimeStatus, runnerStatus, sourceState, incidents, now });
}

function store(incidents = [], state = source()) {
  return {
    async listIncidents({ limit = 100 } = {}) { return incidents.slice(0, limit); },
    async getSourceState() { return state; },
    async stats() { return { incidentCount: incidents.length, byStatus: { open: incidents.filter(item => item.status === 'open').length } }; }
  };
}

test('critical incident produces P0 and red shield', () => {
  const result = overview({ incidents: [incident({ severity: 'critical' })] });
  assert.equal(result.alerts.highestPriority, 'P0');
  assert.equal(result.alerts.alerts[0].code, 'OPEN_CRITICAL_INCIDENT');
  assert.equal(result.shield.color, 'red');
});

test('critical agent health produces P1 without a critical incident', () => {
  const result = overview({ runtimeStatus: runtime({ lastCycleStatus: 'error', consecutiveFailures: 3 }) });
  assert.equal(result.health.level, 'red');
  assert.equal(result.alerts.highestPriority, 'P1');
  assert.equal(result.alerts.alerts.some(item => item.code === 'SECURITY_AGENT_CRITICAL'), true);
});

test('high incidents are P1 and medium incidents are P2', () => {
  const high = overview({ incidents: [incident({ severity: 'high' })] });
  const medium = overview({ incidents: [incident({ severity: 'medium' })] });
  assert.equal(high.alerts.highestPriority, 'P1');
  assert.equal(medium.alerts.highestPriority, 'P2');
});

test('degraded or stale monitoring is P2', () => {
  const degraded = overview({ runtimeStatus: runtime({ lastCycleStatus: 'degraded', consecutiveFailures: 1 }) });
  const stale = overview({ sourceState: source({ lastSuccessAt: '2026-10-03T12:40:00.000Z' }) });
  assert.equal(degraded.alerts.highestPriority, 'P2');
  assert.equal(stale.alerts.alerts.some(item => item.code === 'SECURITY_TELEMETRY_DEGRADED'), true);
});

test('disabled agent is visible as P3, never silently green', () => {
  const result = overview({ runtimeStatus: runtime({ state: 'disabled' }), runnerStatus: runner({ enabled: false, running: false }) });
  assert.equal(result.health.level, 'gray');
  assert.equal(result.alerts.highestPriority, 'P3');
  assert.equal(result.shield.color, 'gray');
});

test('alert model only emits fixed metadata and counts', () => {
  const alerts = buildSecurityAlerts({
    agentHealth: { level: 'red', state: 'running', reasons: ['DATABASE_URL=secret'] },
    telemetry: { status: 'healthy', raw: 'token=secret' },
    openBySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  });
  const text = JSON.stringify(alerts);
  assert.doesNotMatch(text, /DATABASE_URL|token=|secret/);
  assert.match(text, /SECURITY_AGENT_CRITICAL/);
});

test('Security Center service consumes runtime status when supplied', async () => {
  const service = new SecurityCenterService({
    runner: { status: () => runner() },
    runtime: { status: () => runtime({ lastCycleStatus: 'error', consecutiveFailures: 3 }) },
    store: store([])
  });
  const health = await service.getHealth({ now });
  assert.equal(health.health.level, 'red');
  assert.equal(health.alerts.highestPriority, 'P1');
});

test('alert ordering is deterministic from P0 to P3', () => {
  const alerts = buildSecurityAlerts({
    agentHealth: { level: 'orange', state: 'running' },
    telemetry: { status: 'stale' },
    openBySeverity: { critical: 1, high: 1, medium: 1, low: 1, info: 1 }
  });
  assert.deepEqual(alerts.alerts.map(item => item.priority), ['P0', 'P1', 'P2', 'P2', 'P2', 'P3', 'P3']);
});
