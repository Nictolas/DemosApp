'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { invalidateFailedFcmTokens } = require('../services/fcmTokenInvalidationService');

const USER='00000000-0000-4000-8000-000000000611';
const RAW='T'.repeat(125);

function fakePool({ownerExists=true,legacyColumnMissing=false,failAt=null}={}) {
  const state={
    canonicalActive:true,
    legacy:[' '+RAW+' ', 'another-token'],
    calls:[], released:0, commits:0, rollbacks:0
  };
  let snapshot=null,savepoint=null,aborted=false;
  const client={
    async query(sql,params=[]) {
      const q=String(sql).replace(/\s+/g,' ').trim();
      state.calls.push({q,params});
      if(q==='BEGIN'){
        snapshot={canonicalActive:state.canonicalActive,legacy:[...state.legacy]};
        return {rows:[]};
      }
      if(q==='COMMIT') {
        if(aborted) throw Error('Synthetic PostgreSQL transaction aborted');
        state.commits++;
        return {rows:[]};
      }
      if(q==='ROLLBACK') {
        if(snapshot){
          state.canonicalActive=snapshot.canonicalActive;
          state.legacy=[...snapshot.legacy];
        }
        state.rollbacks++;
        return {rows:[]};
      }
      if(q==='SAVEPOINT fcm_invalid_legacy'){
        savepoint={canonicalActive:state.canonicalActive,legacy:[...state.legacy]};
        return {rows:[]};
      }
      if(q==='ROLLBACK TO SAVEPOINT fcm_invalid_legacy'){
        assert.ok(savepoint);
        state.canonicalActive=savepoint.canonicalActive;
        state.legacy=[...savepoint.legacy];
        aborted=false;
        return {rows:[]};
      }
      if(q==='RELEASE SAVEPOINT fcm_invalid_legacy')return {rows:[]};
      if(aborted)throw Object.assign(Error('transaction abort'),{code:'25P02'});
      if(failAt && q.includes(failAt)) {
        aborted=true;
        throw Object.assign(Error('synthetic failure'),{code:'23514'});
      }
      if(q==='SELECT id FROM public.users WHERE id = $1 FOR UPDATE')
        return {rows:ownerExists?[{id:USER}]:[]};
      if(q.startsWith('UPDATE public.user_devices')) {
        assert.deepEqual(params,[USER,[RAW]]);
        assert.match(q,/WHERE user_id = \$1 AND is_active = TRUE/);
        assert.match(q,/btrim\(fcm_token\) = ANY\(\$2::text\[\]\)/);
        state.canonicalActive=false;
        return {rowCount:1};
      }
      if(q.startsWith('SELECT COALESCE(fcm_tokens')) {
        if(legacyColumnMissing){
          aborted=true;
          throw Object.assign(Error('synthetic old schema'),{code:'42703'});
        }
        assert.match(q,/FROM public\.users/);
        return {rows:[{fcm_tokens:[...state.legacy]}]};
      }
      if(q.startsWith('UPDATE public.users SET fcm_tokens')) {
        assert.deepEqual(params,[['another-token'],USER]);
        state.legacy=[...params[0]];
        return {rowCount:1};
      }
      throw Error('unexpected SQL: '+q);
    },
    release() { state.released++; }
  };
  return {state,pool:{connect:async()=>client}};
}

test('atomic invalidation trims/deduplicates tokens and preserves canonical inactive row',async()=>{
  const {pool,state}=fakePool();
  const result=await invalidateFailedFcmTokens(pool,{userId:USER,tokens:[' '+RAW+' ',RAW,'',null]});
  assert.deepEqual(result,{invalidated:1,legacyRemoved:1,skipped:false});
  assert.equal(state.canonicalActive,false);
  assert.deepEqual(state.legacy,['another-token']);
  assert.equal(state.commits,1);
  assert.equal(state.rollbacks,0);
  assert.equal(state.released,1);
  assert.ok(state.calls.some(c=>c.q==='SELECT id FROM public.users WHERE id = $1 FOR UPDATE'));
  assert.ok(state.calls.some(c=>c.q==='SAVEPOINT fcm_invalid_legacy'));
});

test('a failed legacy update rolls back the earlier canonical deactivation',async()=>{
  const {pool,state}=fakePool({failAt:'UPDATE public.users SET fcm_tokens'});
  await assert.rejects(invalidateFailedFcmTokens(pool,{userId:USER,tokens:[RAW]}),
    e=>e.code==='23514');
  assert.equal(state.canonicalActive,true);
  assert.deepEqual(state.legacy,[' '+RAW+' ','another-token']);
  assert.equal(state.commits,0);
  assert.equal(state.rollbacks,1);
  assert.equal(state.released,1);
});

test('missing optional legacy column rolls back savepoint then commits canonical deactivation',async()=>{
  const {pool,state}=fakePool({legacyColumnMissing:true});
  const out=await invalidateFailedFcmTokens(pool,{userId:USER,tokens:[RAW]});
  assert.deepEqual(out,{invalidated:1,legacyRemoved:0,skipped:false});
  assert.equal(state.canonicalActive,false);
  assert.equal(state.commits,1);
  assert.equal(state.rollbacks,0);
  assert.equal(state.released,1);
  assert.ok(state.calls.some(c=>c.q==='ROLLBACK TO SAVEPOINT fcm_invalid_legacy'));
});

test('invalid/empty tokens or an absent account do not update either FCM source',async()=>{
  const empty=fakePool();
  assert.deepEqual(await invalidateFailedFcmTokens(empty.pool,{userId:USER,tokens:[42,'  ',undefined]}),
    {invalidated:0,skipped:true});
  assert.equal(empty.state.calls.length,0);
  const missing=fakePool({ownerExists:false});
  assert.deepEqual(await invalidateFailedFcmTokens(missing.pool,{userId:USER,tokens:[RAW]}),
    {invalidated:0,skipped:true});
  assert.equal(missing.state.rollbacks,1);
  assert.equal(missing.state.released,1);
  assert.equal(missing.state.calls.some(c=>c.q.startsWith('UPDATE public.')),false);
});
