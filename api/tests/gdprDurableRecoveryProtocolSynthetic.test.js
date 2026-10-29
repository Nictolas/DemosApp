'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {
  SyntheticWitness, SyntheticExternalJournal, SyntheticDatabase,
  submitSyntheticOperation, restoreSyntheticSnapshot
}=require('./fixtures/gdprDurableRecoveryPrototype');

const alice={exists:true,consent:true};
const bob={exists:true,consent:false};
const op=(id,action='account_deleted',subject='alice')=>({id,action,subject});
function setup() {
  const witness=new SyntheticWitness();
  return {witness,journal:new SyntheticExternalJournal(witness),
    db:new SyntheticDatabase({alice,bob})};
}
function quarantine(journal,overrides={}) {
  return {writersFenced:true,ingressBlocked:true,providersQuarantined:true,
    independentWitness:journal.witness.current(),...overrides};
}

test('old snapshot replay removes an account deleted AFTER backup, preserving another user',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  assert.deepEqual(submitSyntheticOperation(db,journal,op('delete-1')),
    {confirmed:true,reused:false});
  assert.equal(db.accounts.alice.exists,false);
  assert.equal(old.accounts.alice.exists,true);
  journal.seal();
  const recovered=restoreSyntheticSnapshot(old,journal,quarantine(journal));
  assert.equal(recovered.syntheticAdmission,true);
  assert.equal(recovered.productionRecoveryReady,false);
  assert.equal(recovered.replayed,1);
  assert.deepEqual(recovered.database.accounts.alice,{exists:false,consent:false});
  assert.deepEqual(recovered.database.accounts.bob,bob);
  const twice=restoreSyntheticSnapshot(recovered.database,journal,quarantine(journal));
  assert.deepEqual(twice.database.accounts,recovered.database.accounts);
  assert.equal(twice.database.applied.size,1);
});

test('NO-GO after crash following durable intent but BEFORE PostgreSQL commit',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  assert.throws(()=>submitSyntheticOperation(db,journal,op('intention-only'),
    {crashAt:'after_prepare'}),{code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.equal(db.accounts.alice.exists,true);
  journal.seal();
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,quarantine(journal)),
    {code:'GDPR_MODEL_AMBIGUOUS_INTENT'});
});

test('NO-GO after PostgreSQL commit but BEFORE witnessed commit acknowledgment',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  assert.throws(()=>submitSyntheticOperation(db,journal,op('db-committed'),
    {crashAt:'after_db_commit'}),{code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.equal(db.accounts.alice.exists,false);
  assert.equal(journal.entries.filter(e=>e.phase==='commit').length,0);
  journal.seal();
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,quarantine(journal)),
    {code:'GDPR_MODEL_AMBIGUOUS_INTENT'});
});

test('NO-GO if external witness or checkpoint is missing/stale/forged',()=>{
  const {journal,db,witness}=setup();
  const old=db.snapshot();
  const stale=witness.current();
  submitSyntheticOperation(db,journal,op('delete-1'));
  journal.seal();
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,
    quarantine(journal,{independentWitness:null})),{code:'GDPR_MODEL_WITNESS_MISSING'});
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,
    quarantine(journal,{independentWitness:stale})),{code:'GDPR_MODEL_WITNESS_MISMATCH'});
  const forged={...witness.current(),count:0};
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,
    quarantine(journal,{independentWitness:forged})),{code:'GDPR_MODEL_WITNESS_MISMATCH'});
  witness.lose();
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,quarantine(journal)),
    {code:'GDPR_MODEL_WITNESS_MISSING'});
});

test('NO-GO when journal tail disappears but independent witness remains newest',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  submitSyntheticOperation(db,journal,op('delete-1'));
  journal.seal();
  const newest=journal.witness.current();
  // Simulates a restored old journal snapshot: the independent witness
  // continues to attest more events than the locally visible journal.
  journal.entries.splice(0);
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,
    quarantine(journal,{independentWitness:newest})),{code:'GDPR_MODEL_WITNESS_MISMATCH'});
});

test('NO-GO when journal event content or chain is modified after attestation',()=>{
  const {journal,db}=setup();
  submitSyntheticOperation(db,journal,op('delete-1'));
  journal.seal();
  journal.entries[0].operation.subject='bob';
  assert.throws(()=>restoreSyntheticSnapshot(db.snapshot(),journal,quarantine(journal)),
    {code:'GDPR_MODEL_CHAIN_INVALID'});
});

test('NO-GO if writers, inbound traffic or providers are not independently fenced',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  submitSyntheticOperation(db,journal,op('delete-1'));
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,quarantine(journal)),
    {code:'GDPR_MODEL_WRITERS_NOT_SEALED'});
  journal.seal();
  for(const missing of ['writersFenced','ingressBlocked','providersQuarantined']) {
    assert.throws(()=>restoreSyntheticSnapshot(old,journal,quarantine(journal,{[missing]:false})),
      {code:'GDPR_MODEL_QUARANTINE_NOT_ATTESTED'},missing);
  }
  assert.throws(()=>submitSyntheticOperation(db,journal,op('late-delete')),
    {code:'GDPR_MODEL_JOURNAL_SEALED'});
});

test('external journal unavailable: no confirmation before prepare',()=>{
  const {journal,db}=setup();
  journal.offline=true;
  assert.throws(()=>submitSyntheticOperation(db,journal,op('delete-1')),
    {code:'GDPR_MODEL_EXTERNAL_UNAVAILABLE'});
  assert.deepEqual(db.accounts.alice,alice);
  assert.equal(journal.entries.length,0);
});

test('revoke then later explicit grant: replay preserves the newer consent',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  submitSyntheticOperation(db,journal,op('revoke-1','political_consent_revoked'));
  submitSyntheticOperation(db,journal,op('grant-2','political_consent_granted'));
  journal.seal();
  const recovered=restoreSyntheticSnapshot(old,journal,quarantine(journal));
  assert.equal(recovered.database.accounts.alice.consent,true);
  assert.equal(recovered.replayed,2);
  assert.deepEqual(recovered.database.accounts.bob,bob);
});

test('pending revocation forbids a concurrent grant or automatic retry',()=>{
  const {journal,db}=setup();
  assert.throws(()=>submitSyntheticOperation(db,journal,
    op('revoke-1','political_consent_revoked'),{crashAt:'after_prepare'}),
    {code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.throws(()=>submitSyntheticOperation(db,journal,
    op('grant-2','political_consent_granted')),
    {code:'GDPR_MODEL_AMBIGUOUS_INTENT'});
  assert.throws(()=>submitSyntheticOperation(db,journal,
    op('revoke-1','political_consent_revoked')),
    {code:'GDPR_MODEL_AMBIGUOUS_INTENT'});
});

test('idempotent retry after external commit acknowledgement does not repeat mutation',()=>{
  const {journal,db}=setup();
  assert.throws(()=>submitSyntheticOperation(db,journal,op('delete-1'),
    {crashAt:'after_external_commit'}),{code:'GDPR_MODEL_SIMULATED_CRASH'});
  assert.deepEqual(submitSyntheticOperation(db,journal,op('delete-1')),
    {confirmed:true,reused:true});
  assert.equal(db.applied.size,1);
  assert.equal(journal.entries.length,2);
  assert.throws(()=>submitSyntheticOperation(db,journal,
    op('delete-1','political_consent_granted')),
    {code:'GDPR_MODEL_IDEMPOTENCY_CONFLICT'});
});

test('grant cannot be applied to a deleted account during replay',()=>{
  const {journal,db}=setup();
  submitSyntheticOperation(db,journal,op('delete-1'));
  journal.seal();
  const old=db.snapshot();
  // A genuine conflicting later grant would require a new authorized account
  // lifecycle and a different protocol. It is not silently resurrected.
  assert.throws(()=>db.apply(op('grant-2','political_consent_granted')),
    {code:'GDPR_MODEL_ACCOUNT_DELETED'});
  const result=restoreSyntheticSnapshot(old,journal,quarantine(journal));
  assert.equal(result.database.accounts.alice.exists,false);
});

test('empty journal with sealed independent witness admits only SYNTHETIC replay',()=>{
  const {journal,db}=setup();
  const old=db.snapshot();
  journal.seal();
  const result=restoreSyntheticSnapshot(old,journal,quarantine(journal));
  assert.equal(result.replayed,0);
  assert.equal(result.productionRecoveryReady,false);
});

test('malformed, unapproved and mismatched operations fail closed',()=>{
  const {journal,db}=setup();
  assert.throws(()=>submitSyntheticOperation(db,journal,
    {id:'x',subject:'alice',action:'email_export'}),{code:'GDPR_MODEL_INVALID_OPERATION'});
  assert.throws(()=>submitSyntheticOperation(db,journal,
    {...op('x'), extra:'payload'}),{code:'GDPR_MODEL_INVALID_OPERATION'});
  assert.equal(journal.entries.length,0);
});
