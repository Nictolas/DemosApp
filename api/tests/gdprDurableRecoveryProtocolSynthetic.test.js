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
  submitSyntheticOperation(db,journal,op('delete-1'));
  const stale=witness.current();
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


test('NO-GO when independent witness is offline even with a previously signed current receipt',()=>{
  const {journal,db,witness}=setup();
  const old=db.snapshot();
  submitSyntheticOperation(db,journal,op('delete-after-snapshot'));
  journal.seal();
  const signedBeforeOutage=witness.current();
  // A cached signature is not proof that the external witness remains
  // independently reachable at recovery admission time.
  witness.available=false;
  assert.throws(()=>restoreSyntheticSnapshot(old,journal,
    quarantine(journal,{independentWitness:signedBeforeOutage})),
    {code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
  assert.equal(old.accounts.alice.exists,true);
  // When the test witness returns, the same signed checkpoint may be verified.
  witness.available=true;
  const recovered=restoreSyntheticSnapshot(old,journal,
    quarantine(journal,{independentWitness:witness.current()}));
  assert.equal(recovered.database.accounts.alice.exists,false);
  assert.equal(recovered.productionRecoveryReady,false);
});

test('NO-GO when witness goes offline after signing but before an ambiguous intent is resolved',()=>{
  const {journal,db,witness}=setup();
  assert.throws(()=>submitSyntheticOperation(db,journal,
    op('pending-before-outage'),{crashAt:'after_prepare'}),
    {code:'GDPR_MODEL_SIMULATED_CRASH'});
  const receipt=witness.current();
  witness.available=false;
  assert.throws(()=>journal.finalizeAmbiguousFromOriginalPrimary(
    db,op('pending-before-outage'),{
      originalPrimaryVerified:true,writersFenced:true,independentWitness:receipt
    }),{code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
  assert.equal(journal.prior(op('pending-before-outage')),'pending');
});


test('NO-GO if an older truncated journal attempts to replace a newer signed head',()=>{
  const {journal,db,witness}=setup();
  const oldDb=db.snapshot();
  submitSyntheticOperation(db,journal,op('revoke-1','political_consent_revoked'));
  const olderEntries=structuredClone(journal.entries);
  submitSyntheticOperation(db,journal,op('grant-2','political_consent_granted'));
  const newest=witness.current();
  assert.equal(newest.count,4);
  // A stale journal attempts to seal its truncated history, as might happen
  // if an older database/object listing were mistaken for current state.
  journal.entries=olderEntries;
  assert.throws(()=>journal.seal(),{code:'GDPR_MODEL_WITNESS_NON_MONOTONIC'});
  assert.equal(journal.sealed,false); // failed witness cannot seal an old journal
  assert.deepEqual(witness.current(),newest);
  assert.throws(()=>restoreSyntheticSnapshot(oldDb,journal,
    quarantine(journal,{independentWitness:newest})),
    {code:'GDPR_MODEL_WRITERS_NOT_SEALED'});
  assert.equal(oldDb.accounts.alice.consent,true);
});

test('independent witness refuses same-count substitution, gaps and epoch rollback',()=>{
  const {journal,db,witness}=setup();
  submitSyntheticOperation(db,journal,op('revoke-1','political_consent_revoked'));
  const latest=witness.current();
  const invalid=[
    {...latest,head:'f'.repeat(64)},
    {...latest,count:latest.count-1},
    {...latest,count:latest.count+2,head:'e'.repeat(64)},
    {...latest,epoch:'synthetic-older-epoch'},
    {...latest,head:'not-a-hash'},
    {...latest, sealed:true,count:latest.count+1},
    {...latest, sealed:false}
  ];
  for(const forged of invalid) {
    // Malformed hashes fail input validation before the monotonicity gate.
    const code=forged.head==='not-a-hash'
      ? 'GDPR_MODEL_WITNESS_INVALID_CHECKPOINT'
      : 'GDPR_MODEL_WITNESS_NON_MONOTONIC';
    assert.throws(()=>witness.attest(forged),{code});
    assert.deepEqual(witness.current(),latest);
  }
  journal.seal();
  const sealed=witness.current();
  assert.deepEqual(witness.attest({...sealed}),sealed); // idempotent seal
  assert.throws(()=>witness.attest({...sealed,sealed:false}),
    {code:'GDPR_MODEL_WITNESS_NON_MONOTONIC'});
  assert.throws(()=>witness.attest({...sealed,count:sealed.count+1,head:'a'.repeat(64)}),
    {code:'GDPR_MODEL_WITNESS_NON_MONOTONIC'});
  assert.deepEqual(witness.current(),sealed);
});

test('independent witness loss cannot be hidden by freshly signing a stale journal',()=>{
  const {journal,db,witness}=setup();
  submitSyntheticOperation(db,journal,op('delete-1'));
  witness.lose();
  assert.equal(witness.current(),null);
  assert.throws(()=>journal.seal(),{code:'GDPR_MODEL_WITNESS_MISSING'});
  assert.throws(()=>witness.attest(journal.state()),{code:'GDPR_MODEL_WITNESS_MISSING'});
  assert.throws(()=>restoreSyntheticSnapshot(db.snapshot(),journal,
    quarantine(journal,{independentWitness:null})),
    {code:'GDPR_MODEL_WITNESS_MISSING'});
});

test('independent witness accepts an empty sealed journal only as initial state',()=>{
  const {journal,db,witness}=setup();
  const clean=db.snapshot();
  const sealed=journal.seal();
  assert.equal(sealed.count,0);
  assert.equal(sealed.sealed,true);
  assert.deepEqual(witness.attest(journal.state()),sealed);
  assert.equal(restoreSyntheticSnapshot(clean,journal,quarantine(journal))
    .productionRecoveryReady,false);
  assert.throws(()=>witness.attest({
    ...journal.state(), count:1, head:'f'.repeat(64), sealed:false
  }),{code:'GDPR_MODEL_WITNESS_NON_MONOTONIC'});
});


test('witness refuses a plausible next hash without the exact chained entry',()=>{
  const {journal,db,witness}=setup();
  journal.prepare(op('first-prepare'));
  const previous=witness.current();
  const falseNext={
    epoch:previous.epoch,count:previous.count+1,
    head:'a'.repeat(64),sealed:false
  };
  assert.throws(()=>witness.attest(falseNext),
    {code:'GDPR_MODEL_WITNESS_ENTRY_INVALID'});
  const original=journal.entries[0];
  const fakeEntry={...original,seq:falseNext.count,
    previous:previous.head,hash:falseNext.head};
  assert.throws(()=>witness.attest(falseNext,fakeEntry),
    {code:'GDPR_MODEL_WITNESS_ENTRY_INVALID'});
  assert.throws(()=>witness.attest(falseNext,{...fakeEntry,
    phase:'write-unknown'}),{code:'GDPR_MODEL_WITNESS_ENTRY_INVALID'});
  assert.throws(()=>witness.attest(falseNext,{...fakeEntry,
    operation:{id:'invalid',subject:'alice',action:'not-approved'}}),
    {code:'GDPR_MODEL_WITNESS_ENTRY_INVALID'});
  assert.deepEqual(witness.current(),previous);
  assert.equal(journal.entries.length,1);
  // A legitimate append still receives a witnessed head after the rejects.
  journal.prepare(op('second-prepare','political_consent_revoked','bob'));
  assert.equal(witness.current().count,2);
});

test('failed witness acknowledgement never publishes an unwitnessed journal entry',()=>{
  const {journal,db,witness}=setup();
  journal.prepare(op('first-prepare'));
  const before=structuredClone(journal.entries);
  witness.lose();
  assert.throws(()=>journal.prepare(op('second-prepare',
    'political_consent_revoked','bob')),
    {code:'GDPR_MODEL_WITNESS_MISSING'});
  assert.deepEqual(journal.entries,before);
  assert.equal(journal.sealed,false);
  assert.throws(()=>journal.seal(),{code:'GDPR_MODEL_WITNESS_MISSING'});
  assert.equal(journal.sealed,false);
});

test('witness does not sign a seal carrying a newly introduced event entry',()=>{
  const {journal,witness}=setup();
  journal.prepare(op('first-prepare'));
  const original=witness.current();
  const seal={...journal.state(),sealed:true};
  assert.throws(()=>witness.attest(seal,journal.entries[0]),
    {code:'GDPR_MODEL_WITNESS_ENTRY_INVALID'});
  assert.deepEqual(witness.current(),original);
  journal.seal();
  assert.equal(journal.sealed,true);
});


test('reused committed receipt requires exact SQL operation marker, not just its ID',()=>{
  const {journal,db}=setup();
  const action=op('delete-1');
  submitSyntheticOperation(db,journal,action);
  const before=journal.entries.length;
  // A corrupted marker with the same operation ID must never be acknowledged.
  db.applied.set(action.id,'f'.repeat(64));
  assert.throws(()=>submitSyntheticOperation(db,journal,action),
    {code:'GDPR_MODEL_DB_JOURNAL_DIVERGENCE'});
  assert.equal(journal.entries.length,before);
  assert.equal(db.accounts.alice.exists,false);
});

test('reused receipt fails closed if the independent witness is offline or lost',()=>{
  const {journal,db,witness}=setup();
  const action=op('delete-1');
  submitSyntheticOperation(db,journal,action);
  const count=journal.entries.length;
  witness.available=false;
  assert.throws(()=>submitSyntheticOperation(db,journal,action),
    {code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
  witness.available=true;
  witness.lose();
  assert.throws(()=>submitSyntheticOperation(db,journal,action),
    {code:'GDPR_MODEL_WITNESS_MISSING'});
  assert.equal(journal.entries.length,count);
});

test('reused receipt refuses a truncated or internally altered journal',()=>{
  const action=op('delete-1');
  {
    const {journal,db}=setup();
    submitSyntheticOperation(db,journal,action);
    journal.entries.pop(); // loses the witnessed commit
    assert.throws(()=>submitSyntheticOperation(db,journal,action),
      {code:'GDPR_MODEL_WITNESS_MISMATCH'});
  }
  {
    const {journal,db}=setup();
    submitSyntheticOperation(db,journal,action);
    // Latest head remains unchanged, but an earlier record is modified.
    journal.entries[0].operation.action='political_consent_granted';
    assert.throws(()=>submitSyntheticOperation(db,journal,action),
      {code:'GDPR_MODEL_CHAIN_INVALID'});
  }
});

test('committed retry remains possible with an unrelated pending intent',()=>{
  const {journal,db}=setup();
  const deletion=op('delete-1');
  submitSyntheticOperation(db,journal,deletion);
  journal.prepare(op('bob-pending','political_consent_revoked','bob'));
  const count=journal.entries.length;
  assert.deepEqual(submitSyntheticOperation(db,journal,deletion),
    {confirmed:true,reused:true});
  assert.equal(journal.entries.length,count);
  assert.equal(journal.prior(op('bob-pending','political_consent_revoked','bob')),
    'pending');
});

test('new operation refuses an unverified existing live prefix before SQL changes',()=>{
  const {journal,db,witness}=setup();
  submitSyntheticOperation(db,journal,op('alice-revoke','political_consent_revoked'));
  const before=db.snapshot();
  witness.available=false;
  assert.throws(()=>submitSyntheticOperation(db,journal,
    op('bob-revoke','political_consent_revoked','bob')),
    {code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
  assert.deepEqual(db.accounts,before.accounts);
  assert.equal(journal.entries.length,2);
});
