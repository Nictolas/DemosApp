'use strict';
// TEST-ONLY fail-closed protocol model; no provider, database or real data.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const sha=s=>createHash('sha256').update(s).digest('hex');
const KEY='synthetic-event-001', HASH=sha('synthetic-event-body');
function fixture(){return {sql:new Map([[KEY,{sha256:HASH,phase:'UNKNOWN'}]]),witness:{online:true,durable:true,records:new Map([[KEY,{sha256:HASH,phase:'PREPARED'}]])},key:KEY,hash:HASH};}
function authorizePut({sql,witness,key,hash}){
  if(!witness||witness.online!==true||witness.durable!==true)throw Error('GDPR_B2_INDEPENDENT_WITNESS_UNAVAILABLE');
  const external=witness.records.get(key);
  if(!external||external.sha256!==hash||external.phase!=='PREPARED')throw Error('GDPR_B2_INDEPENDENT_INTENT_NOT_PROVEN');
  const local=sql.get(key);
  if(!local||local.sha256!==hash||local.phase!=='UNKNOWN')throw Error('GDPR_B2_SQL_WITNESS_DIVERGENCE');
  // PREPARED cannot establish whether an earlier remote PUT committed.
  throw Error('GDPR_B2_REMOTE_PUT_OUTCOME_UNKNOWN');
}
test('unknown remote outcome never permits second immutable PUT',()=>assert.throws(()=>authorizePut(fixture()),/REMOTE_PUT_OUTCOME_UNKNOWN/));
test('stale SQL snapshot missing claim is rejected',()=>{const f=fixture();f.sql.clear();assert.throws(()=>authorizePut(f),/SQL_WITNESS_DIVERGENCE/);});
test('offline or lost witness is rejected',()=>{const f=fixture();f.witness.online=false;assert.throws(()=>authorizePut(f),/WITNESS_UNAVAILABLE/);f.witness=null;assert.throws(()=>authorizePut(f),/WITNESS_UNAVAILABLE/);});
test('missing, altered, or uncommitted external record is rejected',()=>{const f=fixture();f.witness.records.clear();assert.throws(()=>authorizePut(f),/INTENT_NOT_PROVEN/);f.witness.records.set(KEY,{sha256:sha('different'),phase:'PREPARED'});assert.throws(()=>authorizePut(f),/INTENT_NOT_PROVEN/);f.witness.records.set(KEY,{sha256:HASH,phase:'UNCONFIRMED'});assert.throws(()=>authorizePut(f),/INTENT_NOT_PROVEN/);});
test('SQL hash collision or changed phase is rejected',()=>{const f=fixture();f.sql.set(KEY,{sha256:sha('changed'),phase:'UNKNOWN'});assert.throws(()=>authorizePut(f),/SQL_WITNESS_DIVERGENCE/);f.sql.set(KEY,{sha256:HASH,phase:'VERIFIED'});assert.throws(()=>authorizePut(f),/SQL_WITNESS_DIVERGENCE/);});
