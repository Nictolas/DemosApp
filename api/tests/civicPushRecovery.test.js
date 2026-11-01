'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { prepareCivicPushRecovery } = require('../services/civicPushRecovery');

const ROOT = path.resolve(__dirname, '../..');
const read = filename => fs.readFileSync(path.join(ROOT, filename), 'utf8');

function fixture({ reason = 'EMERGENCY_STOP', blocked = true, pending = 0,
    dispatching = 0, failed = 0, crashOn = null } = {}) {
  const trace = [];
  const state = { reason, blocked, pending, dispatching, failed };
  const client = {
    async query(sql) {
      const query = sql.trim();
      trace.push(query);
      if (crashOn && query.startsWith(crashOn)) throw new Error('provider secret');
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rows: [] };
      if (query.includes('pg_advisory_xact_lock')) return { rows: [{}] };
      if (query.includes('SELECT blocked, reason_code')) {
        return { rows: [{ blocked: state.blocked, reason_code: state.reason }] };
      }
      if (query.includes('GROUP BY status')) {
        return { rows: [
          { status: 'pending', total: state.pending },
          { status: 'dispatching', total: state.dispatching },
          { status: 'failed', total: state.failed },
          { status: 'suppressed', total: 5 },
        ] };
      }
      if (query.includes('UPDATE civic_push_delivery_guard')) {
        state.reason = 'RECOVERY_HOLD';
        return { rows: [{ id: 1 }] };
      }
      throw new Error('Unexpected SQL: ' + query);
    },
    release: (discard) => trace.push(discard ? 'discard' : 'release'),
  };
  return { state, trace, connect: async () => client };
}

test('recovery preview is read-only with no pending and no uncertain event', async () => {
  const pool = fixture();
  const result = await prepareCivicPushRecovery(pool);
  assert.deepEqual(result, {
    dryRun: true, prepared: false, guardBlocked: true,
    pendingToSuppress: 0, uncertainEventsForManualReview: 0,
    readyForPreparation: true,
  });
  assert.equal(pool.state.reason, 'EMERGENCY_STOP');
  assert.ok(pool.trace.includes('ROLLBACK'));
  assert.ok(!pool.trace.some(x => x.includes('UPDATE civic_push_delivery_guard')));
});

test('recovery requires confirmation before opening database connection', async () => {
  let connects = 0;
  const pool = { connect: async () => { connects++; throw new Error('unexpected'); } };
  await assert.rejects(prepareCivicPushRecovery(pool, { apply: true }),
    /CIVIC_RECOVERY_CONFIRMATION_REQUIRED/);
  assert.equal(connects, 0);
});

test('pending and uncertain events fail closed, even with human apply confirmation', async () => {
  for (const condition of [
    { pending: 1 }, { failed: 1 }, { dispatching: 1 },
    { pending: 4, failed: 2, dispatching: 3 },
  ]) {
    const pool = fixture(condition);
    const result = await prepareCivicPushRecovery(pool, {
      apply: true, confirmed: true,
    });
    assert.equal(result.prepared, false);
    assert.equal(result.guardBlocked, true);
    assert.equal(result.pendingToSuppress, condition.pending || 0);
    assert.equal(result.uncertainEventsForManualReview,
      (condition.failed || 0) + (condition.dispatching || 0));
    assert.equal(pool.state.reason, 'EMERGENCY_STOP');
    assert.ok(!pool.trace.some(x => x.includes('UPDATE civic_push_delivery_guard')));
  }
});

test('manual preparation changes only reason to RECOVERY_HOLD, preserving blocked TRUE', async () => {
  const pool = fixture();
  const result = await prepareCivicPushRecovery(pool, {
    apply: true, confirmed: true,
  });
  assert.deepEqual(result, {
    dryRun: false, prepared: true, guardBlocked: true,
    pendingToSuppress: 0, uncertainEventsForManualReview: 0,
    readyForPreparation: true,
  });
  assert.equal(pool.state.reason, 'RECOVERY_HOLD');
  assert.equal(pool.state.blocked, true);
  assert.ok(pool.trace.find(x =>
    x.includes("SET blocked = TRUE, reason_code = 'RECOVERY_HOLD'")));
  assert.ok(pool.trace.includes('COMMIT'));
  assert.equal(pool.trace.at(-1), 'release');

  // Same operation can be repeated; it does not reset any event status.
  const repeat = await prepareCivicPushRecovery(pool, { apply: true, confirmed: true });
  assert.equal(repeat.prepared, true);
  assert.equal(pool.state.blocked, true);
});

test('only a previously stopped or held, blocked rollout can enter recovery', async () => {
  for (const invalid of [
    { blocked: false }, { reason: 'ROLLOUT_NOT_APPROVED' },
    { reason: 'REVOCATION_UNCERTAIN' },
  ]) {
    const pool = fixture(invalid);
    await assert.rejects(prepareCivicPushRecovery(pool, {
      apply: true, confirmed: true,
    }), /CIVIC_RECOVERY_UNAVAILABLE/);
    assert.ok(pool.trace.includes('ROLLBACK'));
    assert.equal(pool.state.reason, invalid.reason || 'EMERGENCY_STOP');
  }
});

test('DB failure rolls back and hides database details', async () => {
  const pool = fixture({ crashOn: 'UPDATE civic_push_delivery_guard' });
  await assert.rejects(prepareCivicPushRecovery(pool, {
    apply: true, confirmed: true,
  }), e => e.message === 'CIVIC_RECOVERY_UNAVAILABLE' &&
    !e.message.includes('provider secret'));
  assert.ok(pool.trace.includes('ROLLBACK'));
});

test('recovery procedure has no FCM send and leaves the delivery guard blocked', () => {
  const service = read('api/services/civicPushRecovery.js');
  const script = read('api/scripts/prepareCivicPushRecovery.js');
  assert.match(service, /SET blocked = TRUE, reason_code = 'RECOVERY_HOLD'/);
  assert.doesNotMatch(service, /blocked = FALSE|messaging\(\)|sendEachForMulticast/);
  assert.match(script, /I_APPROVE_BLOCKED_RECOVERY_HOLD/);
  assert.doesNotMatch(script, /\.send\(|firebase-admin|ALTER TABLE/);
});

test('collectors suppress new official initiatives whenever delivery is blocked', () => {
  const italian = read('api/services/civicNewInitiativeEventCollector.js');
  const eci = read('api/scripts/sync_eci.py');
  assert.match(italian, /guard\.blocked = TRUE/);
  assert.match(italian, /SELECT blocked, reason_code FROM civic_push_delivery_guard/);
  assert.match(eci, /guard\[0\] is True/);
  assert.match(eci, /SELECT blocked, reason_code FROM civic_push_delivery_guard/);
});
