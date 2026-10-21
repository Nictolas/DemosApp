'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuditOutboxWorker } = require('../jobs/auditOutboxWorker');

test('worker is inert until explicitly enabled; no schedule or DB access', async () => {
  let scheduled = 0;
  const worker = createAuditOutboxWorker({
    outbox: { drainOnce: () => { throw new Error('no writes allowed'); } },
    enabled: () => false,
    schedule: () => { scheduled++; }
  });
  assert.equal(worker.start(), null);
  assert.equal(scheduled, 0);
  assert.deepEqual(await worker.runOnce(), { skipped: true, reason: 'disabled' });
});

test('enabled worker schedules one interval and reports counts without personal data', async () => {
  let tick;
  const messages = [];
  let calls = 0;
  const worker = createAuditOutboxWorker({
    enabled: () => true,
    outbox: { drainOnce: async ({ limit }) => {
      assert.equal(limit, 10);
      calls++;
      return { delivered: 2, rescheduled: 1, deadLettered: 0 };
    } },
    schedule: (callback, interval) => {
      assert.equal(interval, 60000);
      tick = callback;
      return 42;
    },
    unschedule: timer => assert.equal(timer, 42),
    report: (...args) => messages.push(args)
  });
  assert.equal(worker.start(), 42);
  assert.equal(worker.start(), 42);
  tick();
  // Tick is fire-and-forget, so await a direct drain for stable assertions.
  await worker.runOnce();
  assert.ok(calls >= 1);
  assert.ok(messages.some(([code]) => code === 'AUDIT_OUTBOX_WORKER_STARTED'));
  assert.ok(messages.every(x => !JSON.stringify(x).includes('user_id')));
  worker.stop();
});

test('worker prevents overlapping drains', async () => {
  let resolveFirst;
  let calls = 0;
  const worker = createAuditOutboxWorker({
    enabled: () => true,
    outbox: { drainOnce: () => {
      calls++;
      return new Promise(resolve => { resolveFirst = resolve; });
    } },
    report: () => {}
  });
  const first = worker.runOnce();
  assert.deepEqual(await worker.runOnce(), { skipped: true, reason: 'already-running' });
  resolveFirst({ claimed: 1, delivered: 1, rescheduled: 0, deadLettered: 0 });
  await first;
  assert.equal(calls, 1);
});

test('worker masks provider and DB error strings', async () => {
  const messages = [];
  const worker = createAuditOutboxWorker({
    enabled: () => true,
    outbox: { drainOnce: async () => { throw new Error('private-token=abc@example.com'); } },
    report: (...args) => messages.push(args)
  });
  assert.deepEqual(await worker.runOnce(), { failed: true });
  assert.deepEqual(messages, [['AUDIT_OUTBOX_WORKER_FAILED']]);
});

test('worker reports unhealthy backlog in aggregate and limits alert frequency', async () => {
  const codes = [];
  let now = 100;
  let health = {
    total: 4200, pending: 4199, sending: 0,
    deadLetter: 1, oldestWaitSeconds: 1200, capacity: 5000
  };
  const worker = createAuditOutboxWorker({
    enabled: () => true, clock: () => now,
    outbox: {
      drainOnce: async () => ({ delivered: 0, rescheduled: 0, deadLettered: 0 }),
      getHealth: async () => health
    },
    report: (...args) => codes.push(args)
  });
  await worker.runOnce();
  await worker.runOnce();
  assert.deepEqual(codes, [['AUDIT_OUTBOX_HEALTH_WARNING', health]]);
  now += 3600001;
  await worker.runOnce();
  assert.equal(codes.length, 2);
  health = { total: 0, pending: 0, sending: 0, deadLetter: 0,
    oldestWaitSeconds: 0, capacity: 5000 };
  await worker.runOnce();
  health = { ...health, total: 1, pending: 1, oldestWaitSeconds: 901 };
  await worker.runOnce();
  assert.equal(codes.length, 3, 'recovered->unhealthy transition should emit a new alert');
});

test('health failure emits generic warning and does not block delivery', async () => {
  const warnings = [];
  const worker = createAuditOutboxWorker({
    enabled: () => true,
    outbox: {
      drainOnce: async () => ({ claimed: 1, delivered: 1, rescheduled: 0, deadLettered: 0 }),
      getHealth: async () => { throw new Error('private database url in SQL failure'); }
    },
    report: (...args) => warnings.push(args)
  });
  assert.equal((await worker.runOnce()).delivered, 1);
  assert.equal(warnings[0][0], 'AUDIT_OUTBOX_HEALTH_CHECK_FAILED');
  assert.ok(!JSON.stringify(warnings).includes('private database url'));
});
