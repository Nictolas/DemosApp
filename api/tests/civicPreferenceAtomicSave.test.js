'use strict';

// Offline transaction/revocation contract; all tokens/users are synthetic.
// No provider, database connection or Firebase send.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runCivicPreferenceSaveAtomic } =
  require('../services/civicPreferenceAtomicSave');

function fake() {
  const history = [];
  let guardBlocked = false;
  const client = {
    query:async (sql) => { history.push(sql); return {rows:[{user_id:'fixture'}]}; },
  };
  const block = async (db) => {
    assert.equal(db,client);
    history.push('PERSIST_BLOCK_AFTER_ROLLBACK');
    guardBlocked = true;
  };
  return {client,history,block,get guardBlocked(){return guardBlocked;}};
}

test('push disabled keeps old preference save path without additional SQL',async()=>{
  const f=fake();
  const out=await runCivicPreferenceSaveAtomic(f.client, async()=>{
    f.history.push('UPSERT_PREFS');
    return {saved:true};
  },{enabled:false,block:f.block});
  assert.deepEqual(out,{saved:true});
  assert.deepEqual(f.history,['UPSERT_PREFS']);
  assert.equal(f.guardBlocked,false);
});

test('push enabled saves preferences and reconciles FCM inside one DB transaction',async()=>{
  const f=fake();
  const out=await runCivicPreferenceSaveAtomic(f.client,async()=>{
    f.history.push('UNSUBSCRIBE_DISABLED_TOPIC');
    f.history.push('UPSERT_PREFS');
    f.history.push('RECONCILE_ENABLED_TOPIC');
    return {saved:true};
  },{enabled:true,block:f.block});
  assert.deepEqual(out,{saved:true});
  assert.deepEqual(f.history,[
    'BEGIN','UNSUBSCRIBE_DISABLED_TOPIC','UPSERT_PREFS',
    'RECONCILE_ENABLED_TOPIC','COMMIT'
  ]);
  assert.equal(f.guardBlocked,false);
});

test('failure after preference write rolls back before persisting safety guard',async()=>{
  const f=fake();
  await assert.rejects(
    runCivicPreferenceSaveAtomic(f.client,async()=>{
      f.history.push('UPSERT_PREFS');
      throw new Error('SYNTHETIC_FIREBASE_ERROR confidential');
    },{enabled:true,block:f.block}),
    e=>e.message==='CIVIC_PREFERENCE_SAVE_UNCONFIRMED');
  assert.deepEqual(f.history,[
    'BEGIN','UPSERT_PREFS','ROLLBACK','PERSIST_BLOCK_AFTER_ROLLBACK']);
  assert.equal(f.guardBlocked,true);
});

test('failed unsubscribe before preference write never commits and blocks sends',async()=>{
  const f=fake();
  await assert.rejects(runCivicPreferenceSaveAtomic(f.client,async()=>{
    f.history.push('FCM_UNSUBSCRIBE_UNCERTAIN');
    throw new Error('synthetic unsubscribe failed');
  },{enabled:true,block:f.block}),/CIVIC_PREFERENCE_SAVE_UNCONFIRMED/);
  assert.deepEqual(f.history,[
    'BEGIN','FCM_UNSUBSCRIBE_UNCERTAIN','ROLLBACK',
    'PERSIST_BLOCK_AFTER_ROLLBACK']);
});

test('failed rollback makes pooled session unreusable',async()=>{
  const f=fake();
  f.client.query=async sql=>{
    f.history.push(sql);
    if(sql==='ROLLBACK')throw Error('connection lost');
    return {rows:[]};
  };
  await assert.rejects(runCivicPreferenceSaveAtomic(f.client,async()=>{
    throw Error('synthetic failure');
  },{enabled:true,block:f.block}),/CIVIC_PREFERENCE_SAVE_UNCONFIRMED/);
  assert.equal(f.client.__civicPreferenceTransactionUnsafe,true);
  assert.equal(f.guardBlocked,false);
});

test('failed safety guard write marks session unsafe and never returns success',async()=>{
  const f=fake();
  await assert.rejects(runCivicPreferenceSaveAtomic(f.client,async()=>{
    throw Error('synthetic Firebase uncertainty');
  },{enabled:true,block:async()=>{throw Error('guard connection failed');}}),
  /CIVIC_PREFERENCE_SAVE_UNCONFIRMED/);
  assert.equal(f.client.__civicPreferenceTransactionUnsafe,true);
});

test('preference route and session lock use transaction safety contract',()=>{
  const route=fs.readFileSync(path.join(__dirname,'../routes/notifiche.js'),'utf8');
  const lock=fs.readFileSync(path.join(__dirname,'../services/civicPushDeliveryGuard.js'),'utf8');
  assert.match(route,/return runCivicPreferenceSaveAtomic\(db, async \(\) => \{/);
  assert.match(route,/enabled: civicPushEnabled/);
  assert.match(route,/unsubscribeDisabledCivicTopicsForUser\(db, user_id/);
  assert.match(route,/await reconcileCivicTopicsForUser\(db, user_id/);
  assert.match(lock,/discard \|\| client\.__civicPreferenceTransactionUnsafe === true/);
});
