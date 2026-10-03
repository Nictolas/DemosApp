const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSecurityCenterOverview } = require('../security-agent/securityCenterReadModel');
const { SecurityCenterService } = require('../security-agent/securityCenterService');
const { createSecurityCenterHandlers } = require('../security-agent/securityCenterApi');

const now = new Date('2026-10-03T13:00:00.000Z');
const runner = extra => ({ enabled: true, running: true, inFlight: false, lastRunAt: '2026-10-03T12:59:30.000Z', lastRunStatus: 'ok', runCount: 5, failureCount: 0, ...extra });
const source = extra => ({ enabled: true, lastSuccessAt: '2026-10-03T12:59:30.000Z', lastFailureAt: null, consecutiveFailures: 0, totals: { polls: 5, fetched: 20, accepted: 18, duplicates: 2 }, ...extra });
const incident = extra => ({ incidentId: 'inc-1', findingId: 'find-1', ruleId: 'DET-X', severity: 'medium', status: 'open', count: 1, firstSeen: '2026-10-03T12:59:00.000Z', lastSeen: '2026-10-03T12:59:00.000Z', createdAt: '2026-10-03T12:59:00.000Z', updatedAt: '2026-10-03T12:59:00.000Z', ...extra });

function store(incidents = [], state = source()) {
  return {
    listIncidents({ status, severity, limit = 100 } = {}) { return incidents.filter(x => !status || x.status === status).filter(x => !severity || x.severity === severity).slice(0, limit); },
    getSourceState() { return state; },
    stats() {
      const byStatus = {}, bySeverity = {};
      for (const x of incidents) { byStatus[x.status] = (byStatus[x.status] || 0) + 1; bySeverity[x.severity] = (bySeverity[x.severity] || 0) + 1; }
      return { incidentCount: incidents.length, sourceCount: state ? 1 : 0, byStatus, bySeverity };
    }
  };
}

function overview({ runnerStatus = runner(), sourceState = source(), incidents = [] } = {}) {
  return buildSecurityCenterOverview({ runnerStatus, sourceState, incidents, now });
}

test('healthy runner is green', () => assert.equal(overview({ incidents: [incident()] }).shield.color, 'green'));
test('critical incident is red', () => assert.equal(overview({ incidents: [incident({ severity: 'critical' })] }).shield.color, 'red'));
test('high incident or stale telemetry is orange', () => {
  assert.equal(overview({ incidents: [incident({ severity: 'high' })] }).shield.color, 'orange');
  assert.equal(overview({ sourceState: source({ lastSuccessAt: '2026-10-03T12:40:00.000Z' }) }).shield.color, 'orange');
});
test('disabled runner is gray, never false-green', () => assert.equal(overview({ runnerStatus: runner({ enabled: false, running: false }), sourceState: null }).shield.color, 'gray'));
test('read model drops unexpected incident fields', () => {
  const text = JSON.stringify(overview({ incidents: [incident({ ip_address: '203.0.113.1', email: 'secret@example.org', rawPayload: 'secret' })] }));
  assert.doesNotMatch(text, /203\.0\.113\.1|secret@example|rawPayload/);
});
test('service uses allowlisted filters and bounded limits', () => {
  const service = new SecurityCenterService({ runner: { status: () => runner() }, store: store([incident({ severity: 'high' }), incident({ incidentId: 'inc-2', findingId: 'find-2', severity: 'low' })]) });
  assert.equal(service.listIncidents({ severity: 'high' }).length, 1);
  assert.throws(() => service.listIncidents({ severity: 'supercritical' }), /invalid severity/);
  assert.throws(() => service.listIncidents({ limit: 1000 }), /invalid limit/);
});
test('API errors are generic and do not leak exception details', () => {
  const handlers = createSecurityCenterHandlers({ getOverview() { throw new Error('DATABASE_URL=secret'); }, listIncidents() { return []; }, getHealth() { return {}; } });
  let status, body; const res = { status(code) { status = code; return this; }, json(value) { body = value; return value; } };
  handlers.overview({ query: {} }, res);
  assert.equal(status, 500); assert.deepEqual(body, { success: false, error: 'SECURITY_CENTER_READ_FAILED' }); assert.doesNotMatch(JSON.stringify(body), /DATABASE_URL|secret/);
});
test('router source is GET-only', () => {
  const text = fs.readFileSync(path.join(__dirname, '../security-agent/securityCenterRouter.js'), 'utf8');
  assert.match(text, /router\.get\('\/overview'/); assert.match(text, /router\.get\('\/incidents'/); assert.match(text, /router\.get\('\/health'/); assert.doesNotMatch(text, /router\.(post|put|patch|delete)\(/i);
});
