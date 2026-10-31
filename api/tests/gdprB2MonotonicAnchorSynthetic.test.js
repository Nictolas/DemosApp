'use strict';
// No network, no SQL, no real provider. This is a deliberately bounded
// hypothesis test: in-memory "independent" anchor is NOT real durability.
const test=require('node:test');
const assert=require('node:assert/strict');
const {SyntheticMonotonicAnchor,SyntheticReservationJournal,attempt,hash}=
  require('./fixtures/gdprB2MonotonicAnchorSynthetic');
const KEY='synthetic-event-1',OTHER='synthetic-event-2';
const DIGEST=hash('synthetic-erasure-body-1'),OTHER_HASH=hash('synthetic-erasure-body-2');
const f=()=>{
  const anchor=new SyntheticMonotonicAnchor();
  return {anchor,journal:new SyntheticReservationJournal(anchor),
    sql:new Map([[KEY,{digest:DIGEST,phase:'UNKNOWN'}],
      [OTHER,{digest:OTHER_HASH,phase:'UNKNOWN'}]]),
    fakePuts:[]};
};
const denied=(fn,part)=>assert.throws(fn,new RegExp('GDPR_MODEL_ANCHOR_'+part));

test('one fake PUT only after journal and separate monotonic anchor advance',()=>{
  const x=f(),grant=attempt(x,KEY,DIGEST);
  assert.equal(grant.permit,'SYNTHETIC_ONLY_ONE_SHOT');
  assert.equal(grant.productionRecoveryReady,false);
  assert.equal(grant.receipt.count,1);
  assert.equal(x.fakePuts.length,1);
  denied(()=>attempt(x,KEY,DIGEST),'REMOTE_PUT_MAY_HAVE_HAPPENED');
  assert.equal(x.fakePuts.length,1);
});

test('replay of a pre-PUT witness snapshot fails even after restored SQL says UNKNOWN',()=>{
  const x=f(),old=x.journal.entries.slice();
  attempt(x,KEY,DIGEST);
  x.journal=new SyntheticReservationJournal(x.anchor,old);
  denied(()=>attempt(x,KEY,DIGEST),'ROLLBACK_OR_GAP');
  assert.equal(x.fakePuts.length,1);
});

test('history reset cannot authorize ANY other event while independent head is newer',()=>{
  const x=f();attempt(x,KEY,DIGEST);
  x.journal=new SyntheticReservationJournal(x.anchor);
  denied(()=>attempt(x,OTHER,OTHER_HASH),'ROLLBACK_OR_GAP');
  assert.equal(x.fakePuts.length,1);
});

test('two workers with separate stale witnesses but one anchor cannot both issue',()=>{
  const x=f();
  const stale=new SyntheticReservationJournal(x.anchor,x.journal.entries);
  attempt(x,KEY,DIGEST);
  const copy={...x,journal:stale};
  denied(()=>attempt(copy,KEY,DIGEST),'ROLLBACK_OR_GAP');
  assert.equal(x.fakePuts.length,1);
});

test('crash after journal append before anchor does not issue a fake PUT or repair itself',()=>{
  const x=f();
  denied(()=>attempt(x,KEY,DIGEST,{crashAt:'afterJournal'}),
    'INJECTED_CRASH_AFTER_JOURNAL');
  assert.equal(x.fakePuts.length,0);
  assert.equal(x.anchor.current().count,0);
  denied(()=>attempt(x,KEY,DIGEST),'ROLLBACK_OR_GAP');
  denied(()=>attempt(x,OTHER,OTHER_HASH),'ROLLBACK_OR_GAP');
});

test('crash after anchor commit before fake PUT remains single-use NO-GO',()=>{
  const x=f();
  denied(()=>attempt(x,KEY,DIGEST,{crashAt:'afterAnchor'}),
    'INJECTED_CRASH_AFTER_ANCHOR');
  assert.equal(x.fakePuts.length,0);
  assert.equal(x.anchor.current().count,1);
  denied(()=>attempt(x,KEY,DIGEST),'REMOTE_PUT_MAY_HAVE_HAPPENED');
  assert.equal(x.fakePuts.length,0);
});

test('anchor outage prevents first permit and cannot be replaced by SQL status',()=>{
  const x=f();x.anchor.available=false;
  denied(()=>attempt(x,KEY,DIGEST),'UNAVAILABLE');
  assert.equal(x.fakePuts.length,0);
  x.anchor.available=true;attempt(x,KEY,DIGEST);
  assert.equal(x.fakePuts.length,1);
  x.anchor.available=false;
  denied(()=>attempt(x,OTHER,OTHER_HASH),'UNAVAILABLE');
  assert.equal(x.fakePuts.length,1);
});

test('altering digest or sequence breaks hash chain before any further permit',()=>{
  for(const mutation of [
    e=>{e.digest=OTHER_HASH;},
    e=>{e.seq=9;},
    e=>{e.prev='a'.repeat(64);},
    e=>{e.hash='f'.repeat(64);}
  ]) {
    const x=f();attempt(x,KEY,DIGEST);
    mutation(x.journal.entries[0]);
    denied(()=>attempt(x,OTHER,OTHER_HASH),'JOURNAL_DIVERGENCE');
    assert.equal(x.fakePuts.length,1);
  }
});

test('event_key collision with changed digest is never treated as idempotency',()=>{
  const x=f();attempt(x,KEY,DIGEST);
  x.sql.set(KEY,{digest:OTHER_HASH,phase:'UNKNOWN'});
  denied(()=>attempt(x,KEY,OTHER_HASH),'KEY_COLLISION');
  assert.equal(x.fakePuts.length,1);
});

test('snapshot missing the SQL pre-PUT claim cannot be repaired by witness alone',()=>{
  const x=f();x.sql.delete(KEY);
  denied(()=>attempt(x,KEY,DIGEST),'SQL_INTENT_NOT_VERIFIED');
  assert.equal(x.anchor.current().count,0);
  assert.equal(x.fakePuts.length,0);
});

test('fresh distinct event can progress only from the latest independently anchored head',()=>{
  const x=f();
  attempt(x,KEY,DIGEST);
  const grant=attempt(x,OTHER,OTHER_HASH);
  assert.equal(grant.receipt.count,2);
  assert.equal(x.fakePuts.length,2);
  denied(()=>attempt(x,KEY,DIGEST),'REMOTE_PUT_MAY_HAVE_HAPPENED');
});

test('corrupt or stale anchor proof is rejected, not silently reinitialized',()=>{
  const x=f();
  const old=x.anchor.current();
  attempt(x,KEY,DIGEST);
  denied(()=>x.anchor.verify(old),'STALE_OR_FORGED');
  denied(()=>x.anchor.verify({...x.anchor.current(),head:'a'.repeat(64)}),
    'STALE_OR_FORGED');
  assert.equal(x.fakePuts.length,1);
});

test('independent anchor is in-memory: losing BOTH histories is still a real NO-GO gap',()=>{
  const x=f();attempt(x,KEY,DIGEST);
  // This negative demonstration does NOT claim that the model survives loss
  // of both independent storage sources. Production needs durable anti-rollback.
  const freshAnchor=new SyntheticMonotonicAnchor();
  const reset={...x,anchor:freshAnchor,
    journal:new SyntheticReservationJournal(freshAnchor)};
  attempt(reset,KEY,DIGEST);
  assert.equal(x.fakePuts.length,2,
    'EXPECTED MODEL VULNERABILITY: both independent histories lost');
});
