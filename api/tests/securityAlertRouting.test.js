const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAlertRoutingPlan, acknowledgeAlert, alertFingerprint } = require('../security-agent/securityAlertRouting');

const t0 = new Date('2026-10-03T13:00:00.000Z');
const alert = extra => ({ priority: 'P1', code: 'OPEN_HIGH_INCIDENT', scope: 'incidents', count: 2, state: 'high', ...extra });

test('P0 routes to all planned emergency channels', () => {
  const plan = buildAlertRoutingPlan({ alerts: [alert({ priority: 'P0', code: 'OPEN_CRITICAL_INCIDENT', state: 'critical' })], now: t0 });
  assert.deepEqual(plan.routes[0].channels, ['security_center', 'push', 'email', 'external_secondary']);
  assert.equal(plan.routes[0].decision, 'route_simulated');
});

test('P1 uses Security Center and push only', () => {
  const plan = buildAlertRoutingPlan({ alerts: [alert()], now: t0 });
  assert.deepEqual(plan.routes[0].channels, ['security_center', 'push']);
});

test('P2 and P3 remain Security Center plus summary', () => {
  const plan = buildAlertRoutingPlan({ alerts: [alert({ priority: 'P2' }), alert({ priority: 'P3', code: 'LOW' })], now: t0 });
  assert.deepEqual(plan.routes[0].channels, ['security_center', 'summary']);
  assert.deepEqual(plan.routes[1].channels, ['security_center', 'summary']);
});

test('duplicate alert inside cooldown is suppressed', () => {
  const first = buildAlertRoutingPlan({ alerts: [alert()], now: t0 });
  const second = buildAlertRoutingPlan({ alerts: [alert()], routingState: first.state, now: new Date(t0.getTime() + 5 * 60 * 1000) });
  assert.equal(second.routes[0].decision, 'suppressed_cooldown');
  assert.deepEqual(second.routes[0].channels, []);
});

test('priority escalation bypasses prior lower-priority cooldown', () => {
  const first = buildAlertRoutingPlan({ alerts: [alert({ priority: 'P2' })], now: t0 });
  const second = buildAlertRoutingPlan({ alerts: [alert({ priority: 'P1' })], routingState: first.state, now: new Date(t0.getTime() + 1000) });
  assert.equal(second.routes[0].decision, 'route_simulated');
});

test('unacknowledged P1 escalates to email after deadline and cooldown', () => {
  const first = buildAlertRoutingPlan({ alerts: [alert()], now: t0 });
  const second = buildAlertRoutingPlan({ alerts: [alert()], routingState: first.state, now: new Date(t0.getTime() + 31 * 60 * 1000) });
  assert.equal(second.routes[0].decision, 'escalate_simulated');
  assert.deepEqual(second.routes[0].channels, ['security_center', 'email']);
});

test('acknowledged alert stops external simulated routing', () => {
  const first = buildAlertRoutingPlan({ alerts: [alert()], now: t0 });
  const fingerprint = alertFingerprint(alert());
  const ack = acknowledgeAlert({ routingState: first.state, fingerprint, now: new Date(t0.getTime() + 60 * 1000) });
  const next = buildAlertRoutingPlan({ alerts: [alert()], routingState: ack.state, now: new Date(t0.getTime() + 60 * 60 * 1000) });
  assert.equal(next.routes[0].decision, 'acknowledged');
  assert.deepEqual(next.routes[0].channels, ['security_center']);
});

test('routing payload strips unsafe characters and contains no raw fields', () => {
  const plan = buildAlertRoutingPlan({ alerts: [{ priority: 'P0', code: 'X <secret>', scope: 'a/b', state: 'bad state', count: 1, email: 'x@example.org', token: 'secret-token' }], now: t0 });
  const text = JSON.stringify(plan.routes[0]);
  assert.doesNotMatch(text, /x@example|secret-token/);
  assert.match(plan.routes[0].code, /^X__secret_$/);
});

test('unknown priority is ignored safely', () => {
  const plan = buildAlertRoutingPlan({ alerts: [alert({ priority: 'PX' })], now: t0 });
  assert.equal(plan.routes.length, 0);
});
