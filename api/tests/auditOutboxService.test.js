const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuditOutbox, nextDelayMs } = require('../services/auditOutboxService');

const event = Object.freeze({
  _time: '2026-10-21T12:00:00.000Z',
  log_type: 'audit',
  action: 'DATA_ACCESS',
  resource: 'users',
  user_id: 'test-user'
});

test('enqueue persists a minimal tagged event BEFORE returning ID', async () => {
  const calls = [];
  const pool = { async query(sql, params) { calls.push({ sql, params }); return { rowCount: 1 }; } };
  const store = createAuditOutbox({ pool, send: async () => true });
  const id = await store.enqueue(event, 'real-time');
  assert.match(id, /^[a-f0-9-]{36}$/i);
  assert.match(calls[0].sql, /^INSERT INTO demos_private\.audit_delivery_outbox/);
  assert.equal(calls[0].params[0], id);
  const payload = JSON.parse(calls[0].params[3]);
  assert.equal(payload.axiom_delivery_id, id);
  assert.equal(payload.log_type, 'audit');
  assert.equal(payload.user_id, 'test-user');
});

test('enqueue fails closed when DB does not acknowledge persistence', async () => {
  const store = createAuditOutbox({ pool: { query: async () => ({ rowCount: 0 }) }, send: async () => true });
  await assert.rejects(() => store.enqueue(event, 'real-time'), /NOT_ACKNOWLEDGED/);
});

test('oversized or unclassified events cannot be persisted', async () => {
  const store = createAuditOutbox({ pool: { query: () => { throw new Error('should not reach DB'); } }, send: async () => true });
  await assert.rejects(() => store.enqueue({ ...event, log_type: 'technical' }, 'real-time'), /INVALID_CATEGORY/);
  await assert.rejects(() => store.enqueue({ ...event, resource: 'x'.repeat(3000) }, 'real-time'), /TOO_LARGE/);
  await assert.rejects(() => store.enqueue(event, '../bad'), /INVALID_DATASET/);
});

test('drain delivers claimed row and deletes it only after true acknowledgement', async () => {
  const calls = [];
  let deliveredPayload;
  const pool = { async query(sql, params) {
    calls.push(sql);
    if (sql.includes('FOR UPDATE SKIP LOCKED')) {
      return { rows: [{ id: 'record-1', dataset: 'real-time', payload: event, attempt_count: 1 }] };
    }
    if (sql.startsWith('DELETE')) return { rowCount: 1 };
    throw new Error('Unexpected query');
  }};
  const store = createAuditOutbox({ pool, send: async (dataset, payload) => {
    deliveredPayload = { dataset, payload };
    return true;
  }});
  const result = await store.drainOnce();
  assert.deepEqual(result, { claimed: 1, delivered: 1, rescheduled: 0, deadLettered: 0 });
  assert.deepEqual(deliveredPayload, { dataset: 'real-time', payload: event });
  assert.ok(calls[0].includes('SKIP LOCKED'));
  assert.ok(calls[1].startsWith('DELETE'));
});

test('HTTP rejection schedules a retry without deleting the event', async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('FOR UPDATE SKIP LOCKED')) {
      return { rows: [{ id: 'record-2', dataset: 'real-time', payload: event, attempt_count: 1 }] };
    }
    return { rowCount: 1 };
  }};
  const store = createAuditOutbox({ pool, random: () => 0.5, send: async () => false });
  const result = await store.drainOnce();
  assert.equal(result.rescheduled, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].sql.startsWith('UPDATE'));
  assert.equal(calls[1].params[2], 'pending');
  assert.equal(calls[1].params[3], 15000);
});

test('after max attempts moves event to dead-letter for investigation', async () => {
  const notifications = [];
  const pool = { async query(sql, params) {
    if (sql.includes('FOR UPDATE SKIP LOCKED')) {
      return { rows: [{ id: 'record-3', dataset: 'real-time', payload: event, attempt_count: 8 }] };
    }
    assert.equal(params[2], 'dead_letter');
    return { rowCount: 1 };
  }};
  const store = createAuditOutbox({ pool, send: async () => { throw new Error('sensitive provider message'); },
    report: (...args) => notifications.push(args) });
  const result = await store.drainOnce();
  assert.equal(result.deadLettered, 1);
  assert.deepEqual(notifications, [['AUDIT_OUTBOX_DEAD_LETTER', { count: 1 }]]);
});

test('backoff is bounded and jittered', () => {
  assert.equal(nextDelayMs(1, () => 0.5), 15000);
  assert.equal(nextDelayMs(999, () => 1), 4320000);
});
