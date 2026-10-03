const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXTERNAL_CHANNELS,
  MemoryNotificationAudit,
  NotificationDispatcher,
  buildDefaultNoopAdapters,
  createNoopNotificationAdapter,
  sanitizeNotificationTask
} = require('../security-agent/securityNotificationAdapters');

function route(overrides = {}) {
  return {
    fingerprint: 'OPEN_CRITICAL_INCIDENT|incidents|critical',
    priority: 'P0',
    code: 'OPEN_CRITICAL_INCIDENT',
    scope: 'incidents',
    state: 'critical',
    decision: 'route_simulated',
    channels: ['security_center', 'push', 'email', 'external_secondary'],
    ...overrides
  };
}

test('default adapters cover exactly the external notification channels', () => {
  const adapters = buildDefaultNoopAdapters();
  assert.deepEqual(Object.keys(adapters).sort(), [...EXTERNAL_CHANNELS].sort());
  for (const channel of EXTERNAL_CHANNELS) {
    assert.equal(adapters[channel].simulated, true);
    assert.equal(adapters[channel].channel, channel);
  }
});

test('notification task uses a strict privacy-safe allowlist', () => {
  const task = sanitizeNotificationTask({
    channel: 'email',
    fingerprint: 'abc',
    priority: 'P1',
    code: 'TEST',
    scope: 'agent',
    state: 'red',
    rawEvent: { email: 'secret@example.com' },
    token: 'secret-token',
    userId: '123'
  });
  const serialized = JSON.stringify(task);
  assert.doesNotMatch(serialized, /secret@example\.com|secret-token|userId|rawEvent/);
});

test('default dispatcher never delivers externally', async () => {
  const dispatcher = new NotificationDispatcher();
  const result = await dispatcher.dispatchRoutingPlan({ routes: [route()] });
  assert.equal(result.simulated, true);
  assert.equal(result.results.length, 4);
  assert.equal(result.results.find(x => x.channel === 'security_center').outcome, 'internal_only');
  for (const channel of EXTERNAL_CHANNELS) {
    assert.equal(result.results.find(x => x.channel === channel).outcome, 'simulated_noop');
  }
});

test('missing adapter fails closed instead of sending', async () => {
  const dispatcher = new NotificationDispatcher({ adapters: {} });
  const result = await dispatcher.dispatchRoutingPlan({ routes: [route({ channels: ['push'] })] });
  assert.equal(result.results[0].outcome, 'missing_adapter_fail_closed');
});

test('real-looking adapter is blocked while real delivery is disabled', async () => {
  let calls = 0;
  const dispatcher = new NotificationDispatcher({
    adapters: {
      email: {
        name: 'real_email_provider',
        channel: 'email',
        simulated: false,
        async send() { calls += 1; return { delivered: true }; }
      }
    }
  });
  const result = await dispatcher.dispatchRoutingPlan({ routes: [route({ channels: ['email'] })] });
  assert.equal(calls, 0);
  assert.equal(result.results[0].outcome, 'real_adapter_blocked');
});

test('adapter channel mismatch fails closed', async () => {
  const dispatcher = new NotificationDispatcher({ adapters: { email: createNoopNotificationAdapter('push') } });
  const result = await dispatcher.dispatchRoutingPlan({ routes: [route({ channels: ['email'] })] });
  assert.equal(result.results[0].outcome, 'adapter_channel_mismatch');
});

test('adapter exceptions are converted to generic fail-closed audit outcome', async () => {
  const audit = new MemoryNotificationAudit();
  const dispatcher = new NotificationDispatcher({
    audit,
    adapters: {
      push: {
        name: 'broken_push',
        channel: 'push',
        simulated: true,
        async send() { throw new Error('provider host token secret@example.com'); }
      }
    }
  });
  const result = await dispatcher.dispatchRoutingPlan({ routes: [route({ channels: ['push'] })] });
  assert.equal(result.results[0].outcome, 'adapter_error_fail_closed');
  assert.doesNotMatch(JSON.stringify(audit.list()), /provider host|secret@example\.com/);
});

test('audit buffer is bounded and stores only minimal fields', () => {
  const audit = new MemoryNotificationAudit({ maxRecords: 2 });
  for (let i = 0; i < 3; i += 1) {
    audit.append({
      channel: 'push', fingerprint: `f${i}`, priority: 'P1', code: 'TEST',
      decision: 'route_simulated', outcome: 'simulated_noop', adapter: 'noop_push',
      rawPayload: { token: 'secret' }
    });
  }
  assert.equal(audit.list().length, 2);
  assert.equal(audit.list()[0].fingerprint, 'f1');
  assert.doesNotMatch(JSON.stringify(audit.list()), /rawPayload|secret/);
});

test('unsupported channels are rejected before adapter dispatch', () => {
  assert.throws(() => sanitizeNotificationTask({ channel: 'sms', code: 'X' }), /unsupported notification channel/);
});
