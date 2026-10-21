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
