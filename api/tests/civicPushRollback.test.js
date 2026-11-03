'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stopCivicPush } = require('../services/civicPushRollback');

const ROOT = path.resolve(__dirname, '..', '..');
const read = filename => fs.readFileSync(path.join(ROOT, filename), 'utf8');

function fakeDb({ pending = 3, blocked = false, failure = null } = {}) {
  const calls = [];
  const state = { pending, suppressed: 2, blocked, reason_code: 'ROLLOUT_APPROVED' };
  const client = {
    async query(sql) {
      const q = sql.trim();
      calls.push(q);
      if (failure && q.startsWith(failure)) throw new Error('internal DB details');
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return { rows: [] };
      if (q.includes('pg_advisory_xact_lock')) return { rows: [{}] };
      if (q.includes('SELECT blocked, reason_code')) {
        return { rows: [{ blocked: state.blocked, reason_code: state.reason_code }] };
      }
      if (q.includes('COUNT(*)::integer AS total')) {
        return { rows: [
          { status: 'pending', total: state.pending },
          { status: 'suppressed', total: state.suppressed },
          { status: 'sent', total: 6 },
          { status: 'dispatching', total: 1 },
        ] };
      }
      if (q.includes("reason_code = 'EMERGENCY_STOP'")) {
        state.blocked = true;
        state.reason_code = 'EMERGENCY_STOP';
        return { rows: [{ id: 1 }] };
      }
      if (q.includes("status = 'suppressed'")) {
        const previous = state.pending;
        state.pending = 0;
        state.suppressed += previous;
        return { rowCount: previous, rows: Array.from({ length: previous }, (_, i) => ({ id: i })) };
      }
      throw new Error('unexpected SQL');
    },
    release(discard) { calls.push(discard ? 'release_discard' : 'release'); },
  };
  return { state, calls, connect: async () => client };
}

test('default rollback is only a preview and preserves all event statuses', async () => {
  const pool = fakeDb({ pending: 4 });
  const r = await stopCivicPush(pool);
  assert.deepEqual(r, {
    dryRun: true, guardCurrentlyBlocked: false, wouldSuppressPending: 4,
    eventsForManualReview: 1,
  });
  assert.equal(pool.state.pending, 4);
  assert.equal(pool.state.blocked, false);
  assert.ok(pool.calls.some(x => x === 'ROLLBACK'));
  assert.ok(!pool.calls.some(x => x.includes('UPDATE civic_push_delivery_guard')));
  assert.ok(!pool.calls.some(x => x.includes('UPDATE civic_new_initiative_notifications')));
});

test('manual apply requires explicit confirmation before any SQL', async () => {
  let accessed = false;
  const pool = { connect: async () => { accessed = true; throw new Error('unexpected DB'); } };
  await assert.rejects(stopCivicPush(pool, { apply: true }), /CIVIC_ROLLBACK_CONFIRMATION_REQUIRED/);
  assert.equal(accessed, false);
  const script = read('api/scripts/civicPushEmergencyStop.js');
  assert.match(script, /CIVIC_PUSH_ROLLBACK_APPLY === 'true'/);
  assert.match(script, /I_APPROVE_CIVIC_EMERGENCY_STOP/);
  assert.doesNotMatch(script, /sendEachForMulticast|\.send\(/);
});

test('emergency stop blocks delivery before suppressing pending events, idempotently', async () => {
  const pool = fakeDb({ pending: 3 });
  const result = await stopCivicPush(pool, { apply: true, confirmed: true });
  assert.deepEqual(result, {
    dryRun: false, guardBlocked: true, suppressedPending: 3,
    eventsForManualReview: 1,
  });
  assert.equal(pool.state.blocked, true);
  assert.equal(pool.state.reason_code, 'EMERGENCY_STOP');
  assert.equal(pool.state.pending, 0);
  const q = pool.calls;
  const lockIndex = q.findIndex(x => x.includes('pg_advisory_xact_lock'));
  const guardIndex = q.findIndex(x => x.includes('UPDATE civic_push_delivery_guard'));
  const suppressIndex = q.findIndex(x => x.includes('UPDATE civic_new_initiative_notifications'));
  const commitIndex = q.findIndex(x => x === 'COMMIT');
  assert.ok(lockIndex > 0 && guardIndex > lockIndex
    && suppressIndex > guardIndex && commitIndex > suppressIndex);
  assert.deepEqual(q.slice(-2), ['COMMIT', 'release']);

  // Second invocation must never enqueue or retry previously suppressed events.
  const again = await stopCivicPush(pool, { apply: true, confirmed: true });
  assert.equal(again.suppressedPending, 0);
  assert.equal(pool.state.pending, 0);
});

test('a failed emergency-stop write aborts the transaction and sanitizes errors', async () => {
  const pool = fakeDb({ failure: 'UPDATE civic_push_delivery_guard' });
  await assert.rejects(stopCivicPush(pool, { apply: true, confirmed: true }),
    error => error.message === 'CIVIC_ROLLBACK_UNAVAILABLE' &&
      !error.message.includes('internal DB details'));
  assert.ok(pool.calls.includes('ROLLBACK'));
  assert.equal(pool.calls.at(-1), 'release');
});

test('all official collectors suppress new events during emergency stop', () => {
  const italian = read('api/services/civicNewInitiativeEventCollector.js');
  const eci = read('api/scripts/sync_eci.py');
  assert.match(italian, /guard\.reason_code = 'EMERGENCY_STOP'/);
  assert.match(italian, /FOR SHARE/);
  assert.match(eci, /guard\[0\] is True or guard\[1\] == "EMERGENCY_STOP"/);
  assert.match(eci, /FOR SHARE/);
});

test('device routes do not log FCM token prefixes, user IDs or raw errors', () => {
  const deviceApi = read('api/routes/fcm-tokens.js');
  assert.doesNotMatch(deviceApi, /console\.(?:log|error|warn)\([^\n]*userId/);
  assert.doesNotMatch(deviceApi, /console\.(?:log|error|warn)\([^\n]*\.substring\(/);
  assert.doesNotMatch(deviceApi, /details: error\.message/);
  assert.doesNotMatch(deviceApi, /console\.error\([^\n]*, error\)/);
  const prefs = read('api/routes/notifiche.js');
  const saveLog = prefs.slice(prefs.indexOf('// POST /api/notifiche/preferenze'),
    prefs.indexOf('// GET /api/notifiche/ultima'));
  assert.doesNotMatch(saveLog, /console\.log\([^\n]*user_id/);
  assert.doesNotMatch(saveLog, /console\.log\([^\n]*savedPrefs/);
  assert.doesNotMatch(saveLog, /console\.error\([^\n]*, error\)/);
});

test('notification API never logs raw SQL diagnostics or returns DB configuration', () => {
  const route = read('api/routes/notifiche.js');
  assert.doesNotMatch(route, /console\.error\('❌ Error details:'/);
  assert.doesNotMatch(route, /console\.(?:warn|error)\([^\n]*,\s*(?:err|error|e\.message|queryText)\)/);
  assert.doesNotMatch(route, /details: error\.message/);
  assert.doesNotMatch(route, /db_host:\s*process\.env\.DB_HOST/);
  assert.doesNotMatch(route, /database_url_present/);
  assert.doesNotMatch(route, /ultimaNotifica\.titolo\);/);
});

test('rollback does not erase preferences, tokens or already handled outbox rows', () => {
  const source = read('api/services/civicPushRollback.js');
  assert.match(source, /WHERE status = 'pending'/);
  assert.doesNotMatch(source, /DELETE FROM|TRUNCATE|FROM user_devices|UPDATE notifiche_preferenze/);
  assert.match(source, /lockCivicPushDuringAccountErasure\(db\)/);
  const guard = read('api/services/civicPushDeliveryGuard.js');
  assert.match(guard, /pg_advisory_xact_lock/);
  const dispatcher = read('api/services/civicNewInitiativePushDispatcher.js');
  assert.match(dispatcher, /readCivicDeliveryBarrier/);
  assert.match(dispatcher, /if \(safety\.blocked\)/);
});
