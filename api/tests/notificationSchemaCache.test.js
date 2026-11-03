'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNotificationColumnCache } = require('../services/notificationSchemaCache');

test('repeated requests reuse only structural metadata within TTL', async () => {
  let time = 1000;
  let reads = 0;
  const cache = createNotificationColumnCache({ ttlMs: 300000, now: () => time });
  const db = { async query(sql, args) {
    reads++;
    assert.match(sql, /information_schema\.columns/);
    assert.deepEqual(args, ['notifiche_comunali']);
    return { rows: [{ column_name: 'id' }, { column_name: 'titolo' }] };
  } };
  const first = await cache.columns(db, 'notifiche_comunali');
  first.push('PRIVATE_USER_DATA');
  const second = await cache.columns(db, 'notifiche_comunali');
  assert.deepEqual(second, ['id', 'titolo'], 'caller must not mutate cached metadata');
  assert.equal(reads, 1);
  time += 300000;
  await cache.columns(db, 'notifiche_comunali');
  assert.equal(reads, 2, 'TTL expiry refreshes metadata');
});

test('two concurrent feeds share one schema lookup instead of two database queries', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const cache = createNotificationColumnCache();
  const db = { async query() {
    calls++;
    await gate;
    return { rows: [{ column_name: 'id' }] };
  } };
  const a = cache.columns(db, 'notifiche_avvistamenti');
  const b = cache.columns(db, 'notifiche_avvistamenti');
  release();
  const both = await Promise.all([a, b]);
  assert.deepEqual(both, [['id'], ['id']]);
  assert.equal(calls, 1);
});

test('cache is allowlisted and cannot interpolate table names from a user', async () => {
  const cache = createNotificationColumnCache();
  let calls = 0;
  const db = { async query() { calls++; throw new Error('unexpected SQL'); } };
  await assert.rejects(cache.columns(db, 'notifiche_comunali; DROP TABLE users'), /INVALID_NOTIFICATION_TABLE/);
  await assert.rejects(cache.columns(db, 'users'), /INVALID_NOTIFICATION_TABLE/);
  assert.throws(() => cache.invalidate('users'), /INVALID_NOTIFICATION_TABLE/);
  assert.equal(calls, 0);
});

test('missing tables are not cached; newly migrated tables become visible', async () => {
  let reads = 0;
  const cache = createNotificationColumnCache();
  const db = { async query() {
    reads++;
    return { rows: reads === 1 ? [] : [{ column_name: 'id' }] };
  } };
  assert.deepEqual(await cache.columns(db, 'notifiche_avvistamenti'), []);
  assert.deepEqual(await cache.columns(db, 'notifiche_avvistamenti'), ['id']);
  assert.equal(reads, 2);
});

test('failed lookups never poison cache or leave a stuck in-flight promise', async () => {
  let reads = 0;
  const cache = createNotificationColumnCache();
  const db = { async query() {
    reads++;
    if (reads === 1) throw new Error('synthetic database offline');
    return { rows: [{ column_name: 'id' }] };
  } };
  await assert.rejects(cache.columns(db, 'notifiche_comunali'), /synthetic database offline/);
  assert.deepEqual(await cache.columns(db, 'notifiche_comunali'), ['id']);
  assert.equal(reads, 2);
});

test('schema migration invalidation and separate tables do not share columns', async () => {
  const cache = createNotificationColumnCache();
  let reads = 0;
  const db = { async query(sql, args) {
    reads++;
    return { rows: [{ column_name: args[0] === 'notifiche_comunali' ? 'titolo' : 'tipo_avvistamento' }] };
  } };
  assert.deepEqual(await cache.columns(db, 'notifiche_comunali'), ['titolo']);
  assert.deepEqual(await cache.columns(db, 'notifiche_avvistamenti'), ['tipo_avvistamento']);
  assert.equal(reads, 2);
  cache.invalidate('notifiche_comunali');
  await cache.columns(db, 'notifiche_comunali');
  await cache.columns(db, 'notifiche_avvistamenti');
  assert.equal(reads, 3);
});

test('invalid TTL rejected rather than silently disabling caching', () => {
  assert.throws(() => createNotificationColumnCache({ ttlMs: 0 }), /INVALID_SCHEMA_CACHE_TTL/);
  assert.throws(() => createNotificationColumnCache({ ttlMs: NaN }), /INVALID_SCHEMA_CACHE_TTL/);
});
