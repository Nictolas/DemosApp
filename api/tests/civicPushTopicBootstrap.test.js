'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileAllCivicTopics } = require('../services/civicPushTopicBootstrap');
const { CIVIC_TOPIC_BY_CATEGORY } = require('../services/civicPushTopics');

const items = [
  { id: '1', fcm_token: 'token-1', is_active: true, user_status: 'a',
    iniziative_popolari: true, referendum_abrogativi: false, eci: false },
  { id: '2', fcm_token: 'token-2', is_active: false, user_status: 'a',
    iniziative_popolari: true, referendum_abrogativi: true, eci: true },
  { id: '3', fcm_token: 'token-3', is_active: true, user_status: 'a',
    iniziative_popolari: false, referendum_abrogativi: false, eci: true },
];
function pool({ blocked = true, lockError = false } = {}) {
  const queries = [];
  const released = [];
  const db = {
    queries,
    released,
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('pg_advisory_lock(')) {
        if (lockError) throw new Error('uncertain acquisition');
        return { rows: [] };
      }
      if (sql.includes('pg_advisory_unlock(')) return { rows: [{ unlocked: true }] };
      if (sql.includes('civic_push_delivery_guard')) return { rows: [{ blocked }] };
      if (!sql.includes('FROM user_devices d')) throw new Error('unexpected query');
      const [cursor, batchSize] = params;
      return { rows: items.filter(r => Number(r.id) > Number(cursor)).slice(0, batchSize) };
    },
  };
  db.connect = async () => ({
    query: db.query,
    release: (discard) => released.push(Boolean(discard)),
  });
  return db;
}
function fcm() {
  const calls = [];
  return {
    calls,
    subscribeToTopic: async (tokens, topic) => {
      calls.push({ kind: 'subscribe', tokens, topic });
      return { successCount: tokens.length, failureCount: 0 };
    },
    unsubscribeFromTopic: async (tokens, topic) => {
      calls.push({ kind: 'unsubscribe', tokens, topic });
      return { successCount: tokens.length, failureCount: 0 };
    }
  };
}

test('bootstrap defaults to read-only aggregate preview; no calls to Firebase', async () => {
  const db = pool();
  const firebase = fcm();
  const result = await reconcileAllCivicTopics(db, { messaging: firebase, batchSize: 2 });
  assert.equal(result.dryRun, true);
  assert.equal(result.guardRemainsBlocked, true);
  assert.equal(result.scanned, 3);
  assert.deepEqual(result.categories.iniziative_popolari, { subscribed: 1, unsubscribed: 2 });
  assert.deepEqual(result.categories.referendum_abrogativi, { subscribed: 0, unsubscribed: 3 });
  assert.deepEqual(result.categories.eci, { subscribed: 1, unsubscribed: 2 });
  assert.equal(firebase.calls.length, 0);
  assert.equal(db.queries.filter(q => q.sql.includes('FROM user_devices d')).length, 2);
});

test('bootstrap may not run when guard is unlocked or sending flag is off', async () => {
  await assert.rejects(
    reconcileAllCivicTopics(pool({ blocked: false }), { dryRun: true }),
    /CIVIC_BOOTSTRAP_REQUIRES_BLOCKED_DELIVERY/
  );
  await assert.rejects(
    reconcileAllCivicTopics(pool(), { dryRun: false, enabled: false }),
    /CIVIC_PUSH_DISABLED/
  );
});

test('explicit apply reconciles all topics in batches with no send() call', async () => {
  const firebase = fcm();
  const result = await reconcileAllCivicTopics(pool(), {
    dryRun: false, enabled: true, messaging: firebase, batchSize: 2
  });
  assert.equal(result.scanned, 3);
  assert.equal(result.guardRemainsBlocked, true);
  assert.equal(firebase.calls.some(c => c.kind === 'send'), false);
  const subscribed = firebase.calls.filter(c => c.kind === 'subscribe');
  assert.deepEqual(
    subscribed.map(c => [c.topic, c.tokens.join(',')]),
    [
      [CIVIC_TOPIC_BY_CATEGORY.iniziative_popolari, 'token-1'],
      [CIVIC_TOPIC_BY_CATEGORY.eci, 'token-3']
    ]
  );
  assert.equal(firebase.calls.some(c =>
    c.kind === 'subscribe' && c.tokens.includes('token-2')), false);
  assert.ok(firebase.calls.some(c =>
    c.kind === 'unsubscribe' && c.tokens.includes('token-2')));
});

test('bootstrap holds the delivery lock across every Firebase topic change', async () => {
  const db = pool();
  const firebase = fcm();
  await reconcileAllCivicTopics(db, {
    enabled: true, dryRun: false, messaging: firebase, batchSize: 2
  });
  const operations = db.queries.map(entry => entry.sql);
  const acquired = operations.findIndex(x => x.includes('pg_advisory_lock('));
  const gate = operations.findIndex(x => x.includes('FROM civic_push_delivery_guard'));
  const released = operations.findIndex(x => x.includes('pg_advisory_unlock('));
  assert.ok(acquired >= 0 && gate > acquired && released > gate);
  assert.equal(released, operations.length - 1);
  assert.deepEqual(db.released, [false]);
  assert.ok(firebase.calls.length > 0);
});

test('bootstrap releases the delivery lock on blocked guard and provider error', async () => {
  const blockedDb = pool({ blocked: false });
  await assert.rejects(reconcileAllCivicTopics(blockedDb), /CIVIC_BOOTSTRAP_REQUIRES_BLOCKED_DELIVERY/);
  assert.deepEqual(blockedDb.released, [false]);

  const failedDb = pool();
  const firebase = fcm();
  firebase.unsubscribeFromTopic = async () => { throw new Error('token sensitive provider error'); };
  await assert.rejects(reconcileAllCivicTopics(failedDb, {
    enabled: true, dryRun: false, messaging: firebase
  }), e => e.message === 'CIVIC_BOOTSTRAP_FCM_FAILED');
  assert.deepEqual(failedDb.released, [false]);

  const uncertainLock = pool({ lockError: true });
  await assert.rejects(reconcileAllCivicTopics(uncertainLock), /uncertain acquisition/);
  assert.deepEqual(uncertainLock.released, [true]);
});

test('provider failure stops the bootstrap without unlocking the barrier', async () => {
  const firebase = fcm();
  firebase.unsubscribeFromTopic = async () => ({ successCount: 0, failureCount: 1 });
  await assert.rejects(
    reconcileAllCivicTopics(pool(), {
      dryRun: false, enabled: true, messaging: firebase, batchSize: 2
    }),
    /CIVIC_BOOTSTRAP_FCM_FAILED/
  );
});

test('bootstrap caps batches to 500 devices and never handles per-user queries', async () => {
  await assert.rejects(reconcileAllCivicTopics(pool(), { batchSize: 1001 }), /CIVIC_BOOTSTRAP_BATCH_INVALID/);
  const db = pool();
  await reconcileAllCivicTopics(db, { batchSize: 2 });
  const queries = db.queries.map(q => q.sql);
  assert.ok(queries.some(sql => sql.includes('ORDER BY d.id ASC')));
  assert.ok(queries.some(sql => sql.includes('LEFT JOIN notifiche_preferenze')));
  assert.ok(queries.every(sql => !sql.includes('SELECT * FROM users')));
});
