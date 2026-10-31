'use strict';
// TEST ONLY. Hypothetical atomic independent reservation, not an actual
// B2 witness, database, network, production safety mechanism or recovery proof.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
const KEY='synthetic-event-001', DIGEST=hash('synthetic event body');
class Witness {
  constructor(){this.online=true;this.durable=true;this.reservations=new Map();}
  reserve(key,digest){
    if(!this.online||!this.durable)throw Error('WITNESS_UNAVAILABLE');
    if(!/^[0-9a-f]{64}$/.test(digest))throw Error('BAD_DIGEST');
    const previous=this.reservations.get(key);
    if(previous){
      if(previous.digest!==digest)throw Error('WITNESS_KEY_COLLISION');
      throw Error('REMOTE_PUT_MAY_HAVE_HAPPENED');
    }
    // Hypothetical atomic and durable before returning, not implemented.
    this.reservations.set(key,{digest,phase:'RESERVED'});
  }
}
function fixture(){return {sql:new Map([[KEY,{digest:DIGEST,phase:'UNKNOWN'}]]),witness:new Witness(),remotePuts:0};}
function attempt(f,key=KEY,digest=DIGEST){
  const local=f.sql.get(key);
  if(!local||local.digest!==digest||local.phase!=='UNKNOWN')
    throw Error('SQL_INTENT_NOT_VERIFIED');
  f.witness.reserve(key,digest);
  f.remotePuts++;
  return {issued:true,recoveryReady:false};
}
test('first permit is single-use even after lost PUT acknowledgement',()=>{
  const f=fixture();assert.equal(attempt(f).issued,true);
  assert.throws(()=>attempt(f),/REMOTE_PUT_MAY_HAVE_HAPPENED/);
  assert.equal(f.remotePuts,1);
});
test('crash after external reservation but before PUT blocks retry',()=>{
  const f=fixture();f.witness.reserve(KEY,DIGEST);
  assert.throws(()=>attempt(f),/REMOTE_PUT_MAY_HAVE_HAPPENED/);
  assert.equal(f.remotePuts,0);
});
test('new worker with the same witness cannot repeat PUT',()=>{
  const f=fixture();attempt(f);
  const restarted={...f,sql:new Map(f.sql)};
  assert.throws(()=>attempt(restarted),/REMOTE_PUT_MAY_HAVE_HAPPENED/);
  assert.equal(f.remotePuts,1);
});
test('stale SQL snapshot without claim is rejected',()=>{
  const f=fixture();attempt(f);f.sql.clear();
  assert.throws(()=>attempt(f),/SQL_INTENT_NOT_VERIFIED/);
  assert.equal(f.remotePuts,1);
});
test('offline or non-durable witness fails closed',()=>{
  const f=fixture();f.witness.online=false;
  assert.throws(()=>attempt(f),/WITNESS_UNAVAILABLE/);
  f.witness.online=true;f.witness.durable=false;
  assert.throws(()=>attempt(f),/WITNESS_UNAVAILABLE/);
  assert.equal(f.remotePuts,0);
});
test('same key changed hash is rejected by witness',()=>{
  const f=fixture();attempt(f);
  const changed=hash('changed');f.sql.set(KEY,{digest:changed,phase:'UNKNOWN'});
  assert.throws(()=>attempt(f,KEY,changed),/WITNESS_KEY_COLLISION/);
  assert.equal(f.remotePuts,1);
});
test('SQL phase drift blocks a first PUT',()=>{
  const f=fixture();f.sql.set(KEY,{digest:DIGEST,phase:'VERIFIED'});
  assert.throws(()=>attempt(f),/SQL_INTENT_NOT_VERIFIED/);
  assert.equal(f.remotePuts,0);
});
test('competing synchronous workers obtain at most one permit',()=>{
  const f=fixture();assert.equal(attempt(f).issued,true);
  assert.throws(()=>attempt(f),/REMOTE_PUT_MAY_HAVE_HAPPENED/);
  assert.equal(f.remotePuts,1);
});
test('NEGATIVE: witness history loss permits duplicate; anti-rollback remains mandatory',()=>{
  const f=fixture();attempt(f);
  f.witness=new Witness(); // Simulates external history lost and falsely reset.
  attempt(f);
  assert.equal(f.remotePuts,2,'MODEL VULNERABILITY; recovery remains NO-GO');
});
