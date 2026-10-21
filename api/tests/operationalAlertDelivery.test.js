'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const servicePath = require.resolve('../services/operationalAlertService');

function makeService({ failedInserts = 0, hasAdmins = true, beforeInsert = async () => {}, pushThrows = false } = {}) {
  let inserts = 0;
  const records = [];
  const pool = {
    async query(sql, params) {
      if (sql.includes('information_schema.columns')) {
        return { rows: [{ present: true }] };
      }
      if (sql.includes('SELECT id::text AS id FROM users')) {
        return { rows: hasAdmins ? [{ id: 'synthetic-admin' }] : [] };
      }
      if (sql.includes('SELECT to_regclass')) {
        return { rows: [{ table_name: 'public.notifiche_demos' }] };
      }
      if (sql.includes('INSERT INTO notifiche_demos')) {
        inserts++;
        await beforeInsert();
        if (inserts <= failedInserts) throw new Error('private://db?secret=abc@example.com');
        records.push({ params });
        return { rowCount: 1 };
      }
      throw new Error('UNEXPECTED_TEST_QUERY');
    }
  };
  const previousLoad = Module._load;
  try {
    Module._load = function(request, parent, isMain) {
      if (parent?.filename === servicePath && request === '../middleware/auth') return { pool };
      if (parent?.filename === servicePath && request === './firebaseAdmin') {
        return { getFirebaseAdmin: () => {
          if (pushThrows) throw new Error('FCM_SECRET_TOKEN_test-only');
          return null;
        } };
      }
      return previousLoad.call(this, request, parent, isMain);
    };
    delete require.cache[servicePath];
    const service = require('../services/operationalAlertService');
    return { service, records, inserts: () => inserts };
  } finally {
    Module._load = previousLoad;
    delete require.cache[servicePath];
  }
}

const newAlert = () => ({
  type: 'AUDIT_OUTBOX_HEALTH_CHECK_FAILED',
  component: 'audit_outbox',
  code: 'AUDIT_OUTBOX_HEALTH_CHECK_FAILED',
  severity: 'CRITICAL'
});

test('failed SQL notification is retryable; only successful persistence starts cooldown', async () => {
  const f = makeService({ failedInserts: 1 });
  const original = console.error;
  const errorLines = [];
  console.error = (...args) => errorLines.push(args.join(' '));
  try {
    const first = await f.service.sendCriticalAlert(newAlert());
    assert.equal(first.success, false);
    assert.equal(first.suppressed, false);
    const second = await f.service.sendCriticalAlert(newAlert());
    assert.equal(second.success, true);
    assert.equal(second.suppressed, false);
    assert.equal(f.inserts(), 2);
    const third = await f.service.sendCriticalAlert(newAlert());
    assert.equal(third.suppressed, true);
    assert.equal(third.success, true);
    assert.equal(f.inserts(), 2);
    assert.deepEqual(errorLines, ['OPERATIONAL_ALERT_DELIVERY_FAILED']);
    assert.ok(!JSON.stringify(errorLines).includes('abc@example.com'));
  } finally {
    console.error = original;
  }
});

test('no admin recipients and unavailable Firebase do not count as delivery', async () => {
  const f = makeService({ hasAdmins: false });
  const first = await f.service.sendCriticalAlert(newAlert());
  const second = await f.service.sendCriticalAlert(newAlert());
  assert.equal(first.success, false);
  assert.equal(second.success, false);
  assert.equal(second.suppressed, false);
  assert.equal(f.inserts(), 0);
});

test('simultaneous identical alert cannot falsely report success before persistence', async () => {
  let release;
  let started;
  const waiting = new Promise(resolve => { started = resolve; });
  const f = makeService({ beforeInsert: () => new Promise(resolve => {
    release = resolve;
    started();
  }) });
  const firstPromise = f.service.sendCriticalAlert(newAlert());
  await waiting;
  const duplicate = await f.service.sendCriticalAlert(newAlert());
  assert.equal(duplicate.suppressed, true);
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.reason, 'IN_FLIGHT');
  release();
  const original = await firstPromise;
  assert.equal(original.success, true);
  const subsequent = await f.service.sendCriticalAlert(newAlert());
  assert.equal(subsequent.suppressed, true);
  assert.equal(subsequent.success, true);
  assert.equal(f.inserts(), 1);
});

test('cooldown begins only on successful alert; no stale suppression after failed send', async () => {
  const f = makeService({ failedInserts: 1 });
  const originalConsole = console.error;
  console.error = () => {};
  try {
    const a = await f.service.sendCriticalAlert(newAlert());
    assert.equal(a.success, false);
    const fp = f.service.__testables.buildFingerprint(newAlert());
    assert.equal(f.service.__testables.isSuppressed(fp), false);
    const b = await f.service.sendCriticalAlert(newAlert());
    assert.equal(b.success, true);
    assert.equal(f.service.__testables.isSuppressed(fp), true);
  } finally { console.error = originalConsole; }
});

test('persisted in-app alert remains successful when Firebase fails immediately afterward', async () => {
  const f = makeService({ pushThrows: true });
  const first = await f.service.sendCriticalAlert(newAlert());
  assert.equal(first.success, true);
  assert.equal(first.persisted, 1);
  assert.equal(first.push.sent, 0);
  assert.equal(first.push.unavailable, true);
  const repeated = await f.service.sendCriticalAlert(newAlert());
  assert.equal(repeated.success, true);
  assert.equal(repeated.suppressed, true);
  assert.equal(f.inserts(), 1, 'a push outage must not create duplicate in-app records');
});

test('without any persisted recipients, a Firebase exception remains retryable', async () => {
  const f = makeService({ hasAdmins: false, pushThrows: true });
  const first = await f.service.sendCriticalAlert(newAlert());
  assert.equal(first.success, false);
  assert.equal(first.push.unavailable, true);
  const second = await f.service.sendCriticalAlert(newAlert());
  assert.equal(second.success, false);
  assert.equal(second.suppressed, false);
});
