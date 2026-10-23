'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALERT_TYPES, createOutboxAdminNotifier, createProductionOutboxNotifier
} = require('../services/auditOutboxAlertService');

test('admin notifications disabled by default never call external services', async () => {
  let calls = 0;
  const notifier = createOutboxAdminNotifier({
    enabled: () => false,
    sendAlert: async () => { calls++; return { success: true }; }
  });
  assert.deepEqual(await notifier('AUDIT_OUTBOX_DEAD_LETTER'), { success: false, skipped: true });
  assert.equal(calls, 0);
});

test('notification body includes only whitelisted problem codes, not user records', async () => {
  let sent;
  const notifier = createOutboxAdminNotifier({
    enabled: () => true,
    sendAlert: async alert => {
      sent = alert;
      return { success: true, persisted: 1 };
    }
  });
  assert.deepEqual(await notifier('AUDIT_OUTBOX_DEAD_LETTER'), { success: true, suppressed: false });
  assert.deepEqual(sent, {
    type: 'AUDIT_OUTBOX_DEAD_LETTER',
    component: 'audit_outbox',
    severity: 'CRITICAL',
    code: 'AUDIT_OUTBOX_DEAD_LETTER'
  });
  assert.equal(Object.keys(ALERT_TYPES).length, 5);
  await assert.rejects(() => notifier('token@example.com'), /INVALID_KIND/);
});

test('notification failures do not leak raw provider error and report a failed delivery', async () => {
  const notifier = createOutboxAdminNotifier({
    enabled: () => true,
    sendAlert: async () => { throw new Error('sensitive-database-url'); }
  });
  assert.deepEqual(await notifier('AUDIT_OUTBOX_WORKER_FAILED'), { success: false, skipped: false });
});

test('production bridge is null when opt-in flag is not enabled', () => {
  const before = process.env.AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED;
  delete process.env.AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED;
  try { assert.equal(createProductionOutboxNotifier(), null); }
  finally {
    if (before === undefined) delete process.env.AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED;
    else process.env.AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED = before;
  }
});
