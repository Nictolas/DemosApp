const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { NotificationDispatcher } = require('../security-agent/securityNotificationAdapters');
const { SecurityNotificationSimulation } = require('../security-agent/securityNotificationSimulation');
const { SecurityCenterService } = require('../security-agent/securityCenterService');
const { createSecurityCenterHandlers } = require('../security-agent/securityCenterApi');

const t0 = new Date('2026-10-03T13:00:00.000Z');
const critical = extra => ({ priority: 'P0', code: 'OPEN_CRITICAL_INCIDENT', scope: 'incidents', state: 'critical', count: 1, ...extra });

function store() {
  return {
    async listIncidents() { return []; },
    async getSourceState() { return null; },
    async stats() { return { incidentCount: 0, sourceCount: 0, byStatus: {}, bySeverity: {} }; }
  };
}

test('simulation starts in never state and real delivery is forbidden', () => {
  const simulation = new SecurityNotificationSimulation();
  assert.equal(simulation.status().state, 'never');
  assert.equal(simulation.status().simulated, true);
  assert.throws(() => new SecurityNotificationSimulation({
    dispatcher: new NotificationDispatcher({ allowRealDelivery: true })
  }), /cannot allow real delivery/);
});

test('P0 routing is dispatched only through simulated/internal adapters and audited', async () => {
  const simulation = new SecurityNotificationSimulation();
  const result = await simulation.simulate({ alerts: [critical()], now: t0 });
  assert.equal(result.status.state, 'simulated');
  assert.equal(result.status.highestPriority, 'P0');
  assert.equal(result.status.dispatchCount, 4);
  assert.equal(result.status.auditCount, 4);
  assert.equal(result.status.byOutcome.internal_only, 1);
  assert.equal(result.status.byOutcome.simulated_noop, 3);
  assert.equal(simulation.listAudit({ limit: 10 }).length, 4);
});

test('duplicate alert inside cooldown creates no new dispatch or audit record', async () => {
  const simulation = new SecurityNotificationSimulation();
  await simulation.simulate({ alerts: [critical()], now: t0 });
  const second = await simulation.simulate({
    alerts: [critical()],
    now: new Date(t0.getTime() + 60 * 1000)
  });
  assert.equal(second.status.routeCount, 1);
  assert.equal(second.status.dispatchCount, 0);
  assert.equal(second.status.auditCount, 4);
});

test('audit records are newest-first and expose only valid timestamps', async () => {
  const simulation = new SecurityNotificationSimulation();
  await simulation.simulate({ alerts: [critical()], now: t0 });
  const audit = simulation.listAudit({ limit: 2 });
  assert.equal(audit.length, 2);
  assert.equal(Number.isNaN(new Date(audit[0].occurredAt).getTime()), false);
  assert.equal(Number.isNaN(new Date(audit[1].occurredAt).getTime()), false);
});

test('simulation status and audit do not retain raw alert fields', async () => {
  const simulation = new SecurityNotificationSimulation();
  await simulation.simulate({
    alerts: [critical({ email: 'secret@example.org', token: 'secret-token', rawEvent: { ip: '203.0.113.8' } })],
    now: t0
  });
  const serialized = JSON.stringify({ status: simulation.status(), audit: simulation.listAudit({ limit: 20 }) });
  assert.doesNotMatch(serialized, /secret@example\.org|secret-token|203\.0\.113\.8|rawEvent/);
});

test('audit limit is bounded', () => {
  const simulation = new SecurityNotificationSimulation();
  assert.throws(() => simulation.listAudit({ limit: 201 }), /invalid notification audit limit/);
});

test('Security Center overview and health expose simulation status without triggering delivery', async () => {
  const simulation = new SecurityNotificationSimulation();
  await simulation.simulate({ alerts: [critical()], now: t0 });
  const service = new SecurityCenterService({
    runner: { status: () => ({ enabled: false, running: false }) },
    store: store(),
    notificationSimulation: simulation
  });
  const overview = await service.getOverview({ now: t0 });
  assert.equal(overview.notifications.status.state, 'simulated');
  assert.equal(overview.notifications.recentAudit.length, 4);
  const health = await service.getHealth({ now: t0 });
  assert.equal(health.notifications.auditCount, 4);
});

test('Security Center notifications read method exposes bounded audit only', async () => {
  const simulation = new SecurityNotificationSimulation();
  await simulation.simulate({ alerts: [critical()], now: t0 });
  const service = new SecurityCenterService({
    runner: { status: () => ({ enabled: false, running: false }) },
    store: store(),
    notificationSimulation: simulation
  });
  const data = await service.getNotifications({ limit: 1 });
  assert.equal(data.status.simulated, true);
  assert.equal(data.audit.length, 1);
});

test('Security Center without notification simulation reports safe never state', async () => {
  const service = new SecurityCenterService({
    runner: { status: () => ({ enabled: false, running: false }) },
    store: store()
  });
  const data = await service.getNotifications();
  assert.equal(data.status.state, 'never');
  assert.equal(data.status.simulated, true);
  assert.deepEqual(data.audit, []);
});

test('Security Center notification API errors are generic', async () => {
  const handlers = createSecurityCenterHandlers({
    async getOverview() { return {}; },
    async listIncidents() { return []; },
    async getHealth() { return {}; },
    async getNotifications() { throw new Error('provider secret-token'); }
  });
  let status;
  let body;
  const res = {
    status(code) { status = code; return this; },
    json(value) { body = value; return value; }
  };
  await handlers.notifications({ query: {} }, res);
  assert.equal(status, 500);
  assert.deepEqual(body, { success: false, error: 'SECURITY_CENTER_READ_FAILED' });
  assert.doesNotMatch(JSON.stringify(body), /secret-token/);
});

test('Security Center notification route is GET-only', () => {
  const text = fs.readFileSync(path.join(__dirname, '../security-agent/securityCenterRouter.js'), 'utf8');
  assert.match(text, /router\.get\('\/notifications'/);
  assert.doesNotMatch(text, /router\.(post|put|patch|delete)\(/i);
});
