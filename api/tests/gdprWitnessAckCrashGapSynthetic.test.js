'use strict';

// Synthetic-only failure injection. No B2, SQL, network or production restore.
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  SyntheticExternalJournal,SyntheticDatabase,
  submitSyntheticOperation,restoreSyntheticSnapshot
}=require('./fixtures/gdprDurableRecoveryPrototype');

const alice={id:'erase-alice',subject:'alice',action:'account_deleted'};
const bob={id:'revoke-bob',subject:'bob',action:'political_consent_revoked'};
function setup(){
  const journal=new SyntheticExternalJournal();
  const db=new SyntheticDatabase({
    alice:{exists:true,consent:true},
    bob:{exists:true,consent:true}
  });
  return {journal,db};
}
function fences(journal){
  return {writersFenced:true,ingressBlocked:true,providersQuarantined:true,
    independentWitness:journal.witness.current()};
}

test('prepare ACK before journal publication: witness ahead, no SQL write and NO-GO',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  assert.throws(()=>submitSyntheticOperation(db,journal,alice,
    {crashAt:'after_prepare_witness_ack'}),
    {code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.equal(journal.entries.length,0);
  assert.equal(journal.witness.current().count,1);
  assert.equal(db.accounts.alice.exists,true);
  assert.equal(db.applied.size,0);
  assert.throws(()=>submitSyntheticOperation(db,journal,alice),
    {code:'GDPR_MODEL_WITNESS_NON_MONOTONIC'});
  assert.throws(()=>journal.seal(),{code:'GDPR_MODEL_WITNESS_NON_MONOTONIC'});
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,fences(journal)),
    {code:'GDPR_MODEL_WRITERS_NOT_SEALED'});
  assert.equal(journal.sealed,false);
});

test('commit ACK before journal publication: SQL applied but receipt cannot be reused',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  assert.throws(()=>submitSyntheticOperation(db,journal,alice,
    {crashAt:'after_commit_witness_ack'}),
    {code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.equal(db.accounts.alice.exists,false);
  assert.equal(db.hasExactCommit(alice),true);
  assert.deepEqual(journal.entries.map(x=>x.phase),['prepare']);
  assert.equal(journal.witness.current().count,2);
  assert.throws(()=>submitSyntheticOperation(db,journal,alice),
    {code:'GDPR_MODEL_WITNESS_MISMATCH'});
  assert.throws(()=>submitSyntheticOperation(db,journal,bob),
    {code:'GDPR_MODEL_WITNESS_MISMATCH'});
  assert.equal(db.accounts.bob.consent,true);
  assert.throws(()=>journal.seal(),{code:'GDPR_MODEL_WITNESS_NON_MONOTONIC'});
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,fences(journal)),
    {code:'GDPR_MODEL_WRITERS_NOT_SEALED'});
});

test('newer witness than journal blocks even a previously committed retry',()=>{
  const {journal,db}=setup();
  submitSyntheticOperation(db,journal,bob);
  assert.throws(()=>submitSyntheticOperation(db,journal,alice,
    {crashAt:'after_prepare_witness_ack'}),
    {code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.equal(journal.entries.length,2);
  assert.equal(journal.witness.current().count,3);
  assert.throws(()=>submitSyntheticOperation(db,journal,bob),
    {code:'GDPR_MODEL_WITNESS_MISMATCH'});
  assert.equal(db.accounts.alice.exists,true);
});

test('seal ACK crash is recoverable only by re-attesting the same sealed head',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  submitSyntheticOperation(db,journal,alice);
  assert.throws(()=>journal.seal({crashAfterWitness:true}),
    {code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.equal(journal.sealed,false);
  assert.equal(journal.witness.current().sealed,true);
  assert.throws(()=>submitSyntheticOperation(db,journal,alice),
    {code:'GDPR_MODEL_WITNESS_MISMATCH'});
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,fences(journal)),
    {code:'GDPR_MODEL_WRITERS_NOT_SEALED'});
  const sealed=journal.seal();
  assert.equal(journal.sealed,true);
  assert.equal(sealed.sealed,true);
  assert.equal(sealed.count,2);
  const result=restoreSyntheticSnapshot(old,journal,fences(journal));
  assert.equal(result.database.accounts.alice.exists,false);
  assert.equal(result.productionRecoveryReady,false);
});

test('witness unavailable after seal ACK crash forbids even same-head seal retry',()=>{
  const {journal,db}=setup();
  submitSyntheticOperation(db,journal,alice);
  assert.throws(()=>journal.seal({crashAfterWitness:true}),
    {code:'GDPR_MODEL_SIMULATED_CRASH'});
  journal.witness.available=false;
  assert.throws(()=>journal.seal(),{code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
  assert.equal(journal.sealed,false);
  assert.throws(()=>restoreSyntheticSnapshot(db.snapshot(),journal,fences(journal)),
    {code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
});
