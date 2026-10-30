'use strict';

// Test-only deterministic interleavings; not real B2 or live multiwriter proof.
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  SyntheticExternalJournal,SyntheticDatabase,
  submitSyntheticOperation,restoreSyntheticSnapshot
}=require('./fixtures/gdprDurableRecoveryPrototype');

const a={id:'delete-alice',subject:'alice',action:'account_deleted'};
const b={id:'revoke-bob',subject:'bob',action:'political_consent_revoked'};
const grantBob={id:'grant-bob',subject:'bob',action:'political_consent_granted'};
const grantAlice={id:'grant-alice',subject:'alice',action:'political_consent_granted'};
function setup(){
  return {journal:new SyntheticExternalJournal(),
    db:new SyntheticDatabase({
      alice:{exists:true,consent:true},
      bob:{exists:true,consent:true},
      carol:{exists:true,consent:false}
    })};
}
function fences(journal){
  journal.seal();
  return {writersFenced:true,ingressBlocked:true,providersQuarantined:true,
    independentWitness:journal.witness.current()};
}

test('different users may prepare concurrently and commit in reverse order',()=>{
  const {db,journal}=setup();
  const old=db.snapshot();
  assert.equal(journal.prepare(a),'prepared');
  assert.equal(journal.prepare(b),'prepared');
  db.apply(b);
  journal.commit(b);
  db.apply(a);
  journal.commit(a);
  const result=restoreSyntheticSnapshot(old,journal,fences(journal));
  assert.equal(result.replayed,2);
  assert.deepEqual(result.database.accounts.alice,{exists:false,consent:false});
  assert.deepEqual(result.database.accounts.bob,{exists:true,consent:false});
  assert.equal(result.database.accounts.carol.consent,false);
  assert.equal(result.productionRecoveryReady,false);
  assert.deepEqual(journal.entries.map(x=>x.phase),
    ['prepare','prepare','commit','commit']);
  assert.deepEqual(journal.entries.map(x=>x.seq),[1,2,3,4]);
});

test('pending intent for Alice must not block Bob but prevents GLOBAL recovery',()=>{
  const {db,journal}=setup();
  const old=db.snapshot();
  assert.equal(journal.prepare(a),'prepared');
  assert.deepEqual(submitSyntheticOperation(db,journal,b),
    {confirmed:true,reused:false});
  assert.equal(db.accounts.bob.consent,false);
  assert.equal(db.accounts.alice.exists,true);
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,fences(journal)),
    {code:'GDPR_MODEL_AMBIGUOUS_INTENT'});
});

test('same-subject grants and revokes remain serialized despite different IDs',()=>{
  const {db,journal}=setup();
  journal.prepare(b);
  assert.throws(()=>journal.prepare(grantBob),
    {code:'GDPR_MODEL_AMBIGUOUS_INTENT'});
  assert.equal(journal.prepare(a),'prepared');
  assert.equal(journal.entries.length,2);
  assert.equal(db.accounts.bob.consent,true);
});

test('original-primary proof can finalize a confirmed interrupted SQL write',()=>{
  const {db,journal}=setup();
  const old=db.snapshot();
  journal.prepare(a);
  db.apply(a); // Simulates a SQL commit whose external ACK was interrupted.
  const evidence=journal.witness.current();
  const status=journal.finalizeAmbiguousFromOriginalPrimary(db,a,{
    originalPrimaryVerified:true,writersFenced:true,
    independentWitness:evidence
  });
  assert.deepEqual(status,{externallyFinalized:true,productionRecoveryReady:false});
  const result=restoreSyntheticSnapshot(old,journal,fences(journal));
  assert.equal(result.database.accounts.alice.exists,false);
});

test('without original-primary proof, never convert an ambiguous intent to commit',()=>{
  const {db,journal}=setup();
  journal.prepare(a);
  const e=journal.witness.current();
  assert.throws(()=>journal.finalizeAmbiguousFromOriginalPrimary(db,a,{
    originalPrimaryVerified:true,writersFenced:true,independentWitness:e
  }),{code:'GDPR_MODEL_SQL_COMMIT_NOT_ATTESTED'});
  db.apply(a);
  for(const props of [
    {writersFenced:false,originalPrimaryVerified:true,independentWitness:e},
    {writersFenced:true,originalPrimaryVerified:false,independentWitness:e},
    {writersFenced:true,originalPrimaryVerified:true,independentWitness:null}
  ]){
    assert.throws(()=>journal.finalizeAmbiguousFromOriginalPrimary(db,a,props),
      {code:'GDPR_MODEL_ORIGINAL_PRIMARY_NOT_ATTESTED'});
  }
  assert.equal(journal.prior(a),'pending');
});

test('restored snapshot is never accepted as proof of original SQL commit',()=>{
  const {db,journal}=setup();
  journal.prepare(a);
  db.apply(a);
  const old=db.snapshot();
  const lost=old.snapshot();
  lost.applied.clear();
  assert.throws(()=>journal.finalizeAmbiguousFromOriginalPrimary(lost,a,{
    originalPrimaryVerified:true,writersFenced:true,
    independentWitness:journal.witness.current()
  }),{code:'GDPR_MODEL_SQL_COMMIT_NOT_ATTESTED'});
  assert.equal(journal.prior(a),'pending');
});

test('fresh external witness required to finalize ambiguous intent',()=>{
  const {db,journal}=setup();
  journal.prepare(a);
  const older=journal.witness.current();
  db.apply(a);
  submitSyntheticOperation(db,journal,b);
  assert.throws(()=>journal.finalizeAmbiguousFromOriginalPrimary(db,a,{
    originalPrimaryVerified:true,writersFenced:true,
    independentWitness:older
  }),{code:'GDPR_MODEL_WITNESS_MISMATCH'});
  assert.equal(journal.prior(a),'pending');
});

test('unavailable independent witness fails BEFORE an intended SQL mutation',()=>{
  const {db,journal}=setup();
  journal.witness.available=false;
  assert.throws(()=>submitSyntheticOperation(db,journal,a),
    {code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
  assert.equal(journal.entries.length,0);
  assert.equal(db.accounts.alice.exists,true);
});

test('same id reused with different subject or action is rejected',()=>{
  const {db,journal}=setup();
  journal.prepare(a);
  assert.throws(()=>journal.prepare({id:a.id,subject:'bob',action:a.action}),
    {code:'GDPR_MODEL_IDEMPOTENCY_CONFLICT'});
  assert.throws(()=>journal.prepare({id:a.id,subject:'alice',action:'political_consent_revoked'}),
    {code:'GDPR_MODEL_IDEMPOTENCY_CONFLICT'});
  assert.equal(journal.entries.length,1);
});

test('same logical operation with reordered object keys reuses witnessed receipt',()=>{
  const {db,journal}=setup();
  submitSyntheticOperation(db,journal,a);
  const reordered={action:'account_deleted',subject:'alice',id:'delete-alice'};
  assert.deepEqual(submitSyntheticOperation(db,journal,reordered),
    {confirmed:true,reused:true});
  assert.equal(journal.entries.length,2);
});

test('reconciliation cannot finalize if the original SQL marker belongs to another payload',()=>{
  const {db,journal}=setup();
  journal.prepare(a);
  db.apply(b);
  db.applied.set(a.id, db.applied.get(b.id)); // synthetic corrupted SQL marker
  assert.throws(()=>journal.finalizeAmbiguousFromOriginalPrimary(db,a,{
    originalPrimaryVerified:true,writersFenced:true,
    independentWitness:journal.witness.current()
  }),{code:'GDPR_MODEL_SQL_COMMIT_NOT_ATTESTED'});
});

test('same-subject revoke/grant order is retained even with unrelated interleavings',()=>{
  const {db,journal}=setup();
  const old=db.snapshot();
  journal.prepare(b);
  db.apply(b);journal.commit(b);
  journal.prepare(a);db.apply(a);journal.commit(a);
  journal.prepare(grantBob);db.apply(grantBob);journal.commit(grantBob);
  const result=restoreSyntheticSnapshot(old,journal,fences(journal));
  assert.equal(result.replayed,3);
  assert.equal(result.database.accounts.bob.consent,true);
  assert.equal(result.database.accounts.alice.exists,false);
  assert.throws(()=>submitSyntheticOperation(db,journal,grantAlice),
    {code:'GDPR_MODEL_JOURNAL_SEALED'});
});


test('same-subject snapshot markers must form a committed prefix',()=>{
  const {db,journal}=setup();
  submitSyntheticOperation(db,journal,b);
  submitSyntheticOperation(db,journal,grantBob);
  const damaged=db.snapshot();
  damaged.applied.delete(b.id); // later grant marker survives, earlier revoke lost
  const before=damaged.snapshot();
  journal.seal();
  assert.throws(()=>restoreSyntheticSnapshot(damaged,journal,fences(journal)),
    {code:'GDPR_MODEL_SNAPSHOT_LINEAGE_INVALID'});
  assert.deepEqual(damaged.accounts,before.accounts);
  assert.deepEqual([...damaged.applied],[...before.applied]);
});

test('a genuine same-subject prefix snapshot replays the later grant',()=>{
  const {db,journal}=setup();
  submitSyntheticOperation(db,journal,b);
  const old=db.snapshot();
  submitSyntheticOperation(db,journal,grantBob);
  journal.seal();
  const result=restoreSyntheticSnapshot(old,journal,fences(journal));
  assert.equal(result.database.accounts.bob.consent,true);
  assert.equal(result.database.applied.size,2);
  assert.equal(result.productionRecoveryReady,false);
});

test('cross-subject SQL snapshot markers need not match global journal commit order',()=>{
  const {db,journal}=setup();
  journal.prepare(a);
  journal.prepare(b);
  db.apply(a);
  const snapshot=db.snapshot(); // Alice SQL commit precedes Bob
  db.apply(b);
  journal.commit(b); // Bob external commit precedes Alice
  journal.commit(a);
  journal.seal();
  const result=restoreSyntheticSnapshot(snapshot,journal,fences(journal));
  assert.equal(result.database.accounts.alice.exists,false);
  assert.equal(result.database.accounts.bob.consent,false);
  assert.equal(result.database.applied.size,2);
});

test('snapshot refuses unknown or mismatched operation fingerprints',()=>{
  for(const mutate of [
    s=>s.applied.set('foreign-commit','f'.repeat(64)),
    s=>s.applied.set(a.id,'f'.repeat(64))
  ]){
    const {db,journal}=setup();
    submitSyntheticOperation(db,journal,a);
    const snapshot=db.snapshot();
    mutate(snapshot);
    journal.seal();
    assert.throws(()=>restoreSyntheticSnapshot(snapshot,journal,fences(journal)),
      {code:'GDPR_MODEL_SNAPSHOT_LINEAGE_INVALID'});
  }
});

test('snapshot marker plus resurrected deleted account fails before replay',()=>{
  const {db,journal}=setup();
  submitSyntheticOperation(db,journal,a);
  const snapshot=db.snapshot();
  snapshot.accounts.alice.exists=true; // marker and account from different times
  journal.seal();
  assert.throws(()=>restoreSyntheticSnapshot(snapshot,journal,fences(journal)),
    {code:'GDPR_MODEL_SNAPSHOT_STATE_DIVERGENCE'});
  assert.equal(snapshot.accounts.alice.exists,true);
});

test('snapshot marker plus inconsistent consent fails before replay',()=>{
  const {db,journal}=setup();
  submitSyntheticOperation(db,journal,b);
  const snapshot=db.snapshot();
  snapshot.accounts.bob.consent=true;
  journal.seal();
  assert.throws(()=>restoreSyntheticSnapshot(snapshot,journal,fences(journal)),
    {code:'GDPR_MODEL_SNAPSHOT_STATE_DIVERGENCE'});
  assert.equal(snapshot.accounts.bob.consent,true);
});
