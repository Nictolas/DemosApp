const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAuditOutbox, nextDelayMs, MAX_EVENT_BYTES, resolveMaxRecords
} = require('../services/auditOutboxService');

// The mock exercises transaction boundaries but delegates INSERT/worker queries
// to existing test-specific stubs. Real transactional behavior is checked in CI.
function mockPool(pool) {
  return {
    ...pool,
    connect: async () => ({
      query: async (sql, params) => {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) ||
            sql.startsWith('SELECT pg_advisory_xact_lock')) return { rowCount: 1 };
        if (sql.startsWith('SELECT COUNT(*)::integer AS total')) {
          return { rows: [{ total: 0 }] };
        }
        return pool.query(sql, params);
      },
      release() {}
    })
  };
}

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
  const store = createAuditOutbox({ pool: mockPool(pool), send: async () => true });
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
  const store = createAuditOutbox({ pool: mockPool({ query: async () => ({ rowCount: 0 }) }), send: async () => true });
  await assert.rejects(() => store.enqueue(event, 'real-time'), /NOT_ACKNOWLEDGED/);
});

test('oversized or unclassified events cannot be persisted', async () => {
  const store = createAuditOutbox({ pool: mockPool({ query: () => { throw new Error('should not reach DB'); } }), send: async () => true });
  await assert.rejects(() => store.enqueue({ ...event, log_type: 'technical' }, 'real-time'), /INVALID_CATEGORY/);
  await assert.rejects(() => store.enqueue({ ...event, resource: 'x'.repeat(3000) }, 'real-time'), /TOO_LARGE/);
  await assert.rejects(() => store.enqueue(event, '../bad'), /INVALID_DATASET/);
});

test('stored payload size includes generated deduplication ID', async () => {
  let queries = 0;
  const store = createAuditOutbox({
    pool: mockPool({ query: async () => { queries++; return { rowCount: 1 }; } }),
    send: async () => true
  });
  let padding = 1800;
  while (Buffer.byteLength(JSON.stringify({ ...event, action: 'X'.repeat(padding) })) < MAX_EVENT_BYTES - 15) padding++;
  const nearLimit = { ...event, action: 'X'.repeat(padding) };
  assert.ok(Buffer.byteLength(JSON.stringify(nearLimit)) <= MAX_EVENT_BYTES);
  await assert.rejects(() => store.enqueue(nearLimit, 'real-time'), /TOO_LARGE/);
  assert.equal(queries, 0);
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
  const store = createAuditOutbox({ pool: mockPool(pool), send: async (dataset, payload) => {
    deliveredPayload = { dataset, payload };
    return true;
  }});
  const result = await store.drainOnce({ limit: 1 });
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
  const store = createAuditOutbox({ pool: mockPool(pool), random: () => 0.5, send: async () => false });
  const result = await store.drainOnce({ limit: 1 });
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
  const store = createAuditOutbox({ pool: mockPool(pool), send: async () => { throw new Error('sensitive provider message'); },
    report: (...args) => notifications.push(args) });
  const result = await store.drainOnce({ limit: 1 });
  assert.equal(result.deadLettered, 1);
  assert.deepEqual(notifications, [['AUDIT_OUTBOX_DEAD_LETTER', { count: 1 }]]);
});

test('batch is bounded to ten sequential claims with separate leases', async () => {
  const events = Array.from({ length: 13 }, (_, i) => ({
    id: 'record-' + i, dataset: 'real-time', payload: event, attempt_count: 1
  }));
  const seen = [];
  const store = createAuditOutbox({
    pool: mockPool({
      async query(sql, params) {
        if (sql.includes('FOR UPDATE SKIP LOCKED')) {
          assert.equal(params[0], 1, 'each claim reserves only the next event');
          seen.push(['claim', params[1]]);
          return { rows: events.length ? [events.shift()] : [] };
        }
        if (sql.startsWith('DELETE')) {
          seen.push(['ack', params[1]]);
          return { rowCount: 1 };
        }
        throw new Error('unexpected query');
      }
    }),
    send: async () => { seen.push(['send']); return true; }
  });
  const first = await store.drainOnce({ limit: 1000 });
  assert.equal(first.claimed, 10);
  assert.equal(first.delivered, 10);
  assert.equal(events.length, 3);
  const second = await store.drainOnce({ limit: 10 });
  assert.equal(second.claimed, 3);
  assert.equal(second.delivered, 3);
  assert.equal(events.length, 0);
  for (let n = 0; n < 13; n++) {
    assert.equal(seen[n * 3][0], 'claim');
    assert.equal(seen[n * 3 + 1][0], 'send');
    assert.equal(seen[n * 3 + 2][0], 'ack');
    assert.equal(seen[n * 3][1], seen[n * 3 + 2][1]);
  }
  // The final empty claim probes for more work but is never sent or ACKed.
  assert.equal(new Set(seen.filter(s => s[0] === 'claim').map(s => s[1])).size, 14);
  assert.equal(seen.filter(s => s[0] === 'ack').length, 13);
});

test('backoff is bounded and jittered', () => {
  assert.equal(nextDelayMs(1, () => 0.5), 15000);
  assert.equal(nextDelayMs(999, () => 1), 4320000);
});

test('capacity defaults to 5000 rows and invalid overrides fail closed', () => {
  assert.equal(resolveMaxRecords(undefined), 5000);
  assert.equal(resolveMaxRecords('1'), 1);
  assert.equal(resolveMaxRecords('10000'), 10000);
  for (const invalid of ['-1', '0', '10001', '1.2', 'no', ' ', 'Infinity']) {
    assert.throws(() => resolveMaxRecords(invalid), /OUTBOX_INVALID_CAPACITY/);
  }
});

test('enqueue rolls back when capacity is reached without writing the event', async () => {
  const calls = [];
  let released = false;
  const pool = {
    query: async () => { throw new Error('Direct query must not be used'); },
    connect: async () => ({
      query: async (sql, params) => {
        calls.push(sql);
        if (sql.startsWith('SELECT COUNT(*)')) return { rows: [{ total: 1 }] };
        if (sql.startsWith('INSERT')) throw new Error('Must never INSERT over capacity');
        return { rowCount: 1 };
      },
      release() { released = true; }
    })
  };
  const notifications = [];
  const store = createAuditOutbox({
    pool, send: async () => true, maxRecords: 1,
    report: (...values) => notifications.push(values)
  });
  await assert.rejects(() => store.enqueue(event, 'real-time'), /OUTBOX_CAPACITY_EXCEEDED/);
  await assert.rejects(() => store.enqueue(event, 'real-time'), /OUTBOX_CAPACITY_EXCEEDED/);
  assert.ok(calls.includes('BEGIN'));
  assert.ok(calls.some(sql => sql.startsWith('SELECT pg_advisory_xact_lock')));
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.includes('COMMIT'));
  assert.ok(released);
  assert.deepEqual(notifications, [['AUDIT_OUTBOX_AT_CAPACITY', { capacity: 1 }]]);
});

test('getHealth exposes only aggregate counts and age, never payloads', async () => {
  const store = createAuditOutbox({
    pool: mockPool({
      query: async sql => {
        assert.ok(sql.includes('COUNT(*) FILTER'));
        return {
          rows: [{
            total: 5, pending: 2, sending: 1, dead_letter: 2,
            oldest_wait_seconds: 901,
            ignored_payload: 'sensitive'
          }]
        };
      }
    }),
    send: async () => true,
    maxRecords: 5
  });
  assert.deepEqual(await store.getHealth(), {
    total: 5, pending: 2, sending: 1, deadLetter: 2,
    oldestWaitSeconds: 901, capacity: 5
  });
});

test('database preflight denial prevents enqueue, worker claims, and health reads', async () => {
  let dbCalls = 0;
  const pool = mockPool({ query: async () => {
    dbCalls++;
    return { rowCount: 1 };
  } });
  const store = createAuditOutbox({
    pool,
    send: async () => { throw new Error('must never contact Axiom'); },
    ensureReady: async () => { throw new Error('AUDIT_OUTBOX_DATABASE_PREFLIGHT_FAILED'); }
  });
  await assert.rejects(() => store.enqueue(event, 'real-time'), /PREFLIGHT_FAILED/);
  await assert.rejects(() => store.drainOnce(), /PREFLIGHT_FAILED/);
  await assert.rejects(() => store.getHealth(), /PREFLIGHT_FAILED/);
  assert.equal(dbCalls, 0);
});


test('staging outbox validation rejects a live Axiom dataset before insertion', () => {
  const { assertOutboxEvent } = require('../services/auditOutboxService');
  const original = process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE;
  try {
    process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = 'staging';
    assert.throws(
      () => assertOutboxEvent(event, 'real-time'),
      error => error.message === 'OUTBOX_AXIOM_DATASET_SCOPE_REJECTED'
    );
    assert.doesNotThrow(() => assertOutboxEvent({
      _time: event._time, log_type: 'audit', synthetic: true,
      action: 'STAGING_OUTBOX_DRILL', resource: 'outbox', success: true
    }, 'demos-security-staging'));
  } finally {
    if (original === undefined) delete process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE;
    else process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = original;
  }
});
