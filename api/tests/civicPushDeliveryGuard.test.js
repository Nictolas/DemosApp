'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readCivicDeliveryBarrier, blockCivicDeliveryOnRevocationFailure } = require('../services/civicPushDeliveryGuard');

function db({ guard = [{ blocked: false }], inactive = [{ unsafe: false }], failAt = 0 } = {}) {
  const calls = [];
  return { calls, async query(sql) {
    calls.push(String(sql));
    if (failAt === calls.length) throw new Error('SYNTHETIC_DATABASE_OUTAGE');
    return { rows: calls.length === 1 ? guard : inactive };
  } };
}

test('delivery guard permits sends only with unblocked guard and no inactive devices', async () => {
  const pool = db();
  assert.deepEqual(await readCivicDeliveryBarrier(pool), { blocked: false, reason: 'CIVIC_DELIVERY_GUARD_BLOCKED' });
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[1], /user_devices/);
  assert.match(pool.calls[1], /u\.status/);
});

test('blocked or missing guard never queries recipients', async () => {
  for (const guard of [[], [{ blocked: true }], [{ blocked: null }]]) {
    const pool = db({ guard });
    assert.equal((await readCivicDeliveryBarrier(pool)).blocked, true);
    assert.equal(pool.calls.length, 1);
  }
});

test('inactive, unknown or ambiguous device status fails closed', async () => {
  for (const inactive of [[], [{ unsafe: true }], [{ unsafe: null }], [{ unsafe: false }, { unsafe: false }]]) {
    const pool = db({ inactive });
    assert.equal((await readCivicDeliveryBarrier(pool)).blocked, true);
  }
});

test('database failures cannot be converted to a delivery approval', async () => {
  for (const failAt of [1, 2]) {
    await assert.rejects(readCivicDeliveryBarrier(db({ failAt })), /SYNTHETIC_DATABASE_OUTAGE/);
  }
});

test('uncertain revocation globally blocks delivery; missing guard row is an error', async () => {
  const calls = [];
  const client = { async query(sql) { calls.push(sql); return { rows: [{ id: 1 }] }; } };
  await blockCivicDeliveryOnRevocationFailure(client);
  assert.match(calls[0], /SET blocked = TRUE/);
  assert.match(calls[0], /REVOCATION_UNCERTAIN/);
  await assert.rejects(blockCivicDeliveryOnRevocationFailure({ query: async () => ({ rows: [] }) }), /CIVIC_DELIVERY_GUARD_NOT_INITIALIZED/);
});

test('global emergency-stop discarded on lost COMMIT acknowledgement', async () => {
  const statements=[];
  let released;
  const client={
    query: async (sql) => {
      statements.push(String(sql));
      if(sql.includes('UPDATE civic_push_delivery_guard')) return {rows:[{id:1}]};
      if(sql==='COMMIT') throw Error('SYNTHETIC_ACK_LOST');
      return {rows:[]};
    },
    release: (discard) => { released=discard; }
  };
  await assert.rejects(
    require('../services/civicPushDeliveryGuard').blockCivicDeliveryFromPool({
      connect:async()=>client,
    }), /CIVIC_DELIVERY_BLOCK_FAILED/
  );
  assert.equal(released,true,'unknown COMMIT must never reuse pooled session');
  assert.deepEqual(statements.slice(-2),['COMMIT','ROLLBACK']);
});

test('global emergency-stop discards session after failed ROLLBACK', async () => {
  let released;
  const client={
    query: async (sql) => {
      if(sql.includes('pg_advisory_xact_lock')) throw Error('LOCK_FAILED');
      if(sql==='ROLLBACK')throw Error('ROLLBACK_FAILED');
      return {rows:[]};
    },
    release:discard=>{released=discard;}
  };
  await assert.rejects(
    require('../services/civicPushDeliveryGuard').blockCivicDeliveryFromPool({
      connect:async()=>client,
    }),/CIVIC_DELIVERY_BLOCK_FAILED/
  );
  assert.equal(released,true);
});

test('global emergency stop discards pooled session on lost BEGIN acknowledgement', async () => {
  const calls=[];
  let released;
  const client={
    query:async sql=>{
      calls.push(sql);
      if(sql==='BEGIN')throw Error('SYNTHETIC_BEGIN_ACK_LOST');
      return {rows:[]};
    },
    release:discard=>{released=discard;}
  };
  await assert.rejects(
    require('../services/civicPushDeliveryGuard').blockCivicDeliveryFromPool({
      connect:async()=>client,
    }),/CIVIC_DELIVERY_BLOCK_FAILED/
  );
  assert.deepEqual(calls,['BEGIN','ROLLBACK']);
  assert.equal(released,true);
});
