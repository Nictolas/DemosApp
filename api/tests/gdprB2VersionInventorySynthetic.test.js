'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  SyntheticExternalJournal, SyntheticDatabase, submitSyntheticOperation
} = require('./fixtures/gdprDurableRecoveryPrototype');
const {
  BAD, keyFor, verifySyntheticB2VersionInventory
} = require('./fixtures/gdprB2VersionInventorySynthetic');

const operation = (id, subject, action = 'account_deleted') =>
  ({id,subject,action});
function setup() {
  const journal = new SyntheticExternalJournal();
  const db = new SyntheticDatabase({
    alice:{exists:true,consent:true},
    bob:{exists:true,consent:true}
  });
  submitSyntheticOperation(db,journal,operation('erase-alice','alice'));
  submitSyntheticOperation(db,journal,
    operation('revoke-bob','bob','political_consent_revoked'));
  journal.seal();
  return {journal,db,checkpoint:journal.witness.current()};
}
function record(journal,entry) {
  const bytes=Buffer.from(JSON.stringify(entry));
  return {
    Key:keyFor(journal.epoch,entry.seq),
    VersionId:'synthetic-version-'+entry.seq,
    ContentLength:bytes.length,
    Sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    Body:bytes,
    IsLatest:true,
    DeleteMarker:false
  };
}
function pagesFor(journal) {
  const records=journal.entries.map(e=>record(journal,e));
  return [
    {cursor:null,nextCursor:'page2',objects:records.slice(0,2)},
    {cursor:'page2',nextCursor:null,objects:records.slice(2)}
  ];
}
const rejected = fn => assert.throws(fn,{code:BAD});
test('sealed, witnessed synthetic inventory of all event versions is NOT recovery GO',()=>{
  const {journal,checkpoint}=setup();
  const result=verifySyntheticB2VersionInventory(journal,checkpoint,pagesFor(journal));
  assert.equal(result.syntheticInventoryVerified,true);
  assert.equal(result.inspectedVersions,4);
  assert.equal(result.productionRecoveryReady,false);
  assert.equal(result.completeGdprJournalVerified,false);
  assert.equal(result.externalProviderAttested,false);
  assert.equal(result.isolatedRestoreVerified,false);
});
test('missing first, middle or last version is not a complete inventory',()=>{
  const {journal,checkpoint}=setup();
  for(const missing of [0,1,3]){
    const pages=pagesFor(journal);
    const list=pages.flatMap(p=>p.objects).filter((_,i)=>i!==missing);
    rejected(()=>verifySyntheticB2VersionInventory(journal,checkpoint,
      [{cursor:null,nextCursor:null,objects:list}]));
  }
});
test('reordering, duplicates, extra objects and repeated version IDs fail closed',()=>{
  const {journal,checkpoint}=setup();
  const original=pagesFor(journal).flatMap(p=>p.objects);
  for(const list of [
    [original[1],original[0],original[2],original[3]],
    [original[0],original[1],original[1],original[3]],
    [...original,original[0]],
    [original[0],{...original[1],VersionId:original[0].VersionId},
      original[2],original[3]]
  ]) rejected(()=>verifySyntheticB2VersionInventory(journal,checkpoint,
    [{cursor:null,nextCursor:null,objects:list}]));
});
test('tampered bytes, digest, length, key and object version metadata fail',()=>{
  const {journal,checkpoint}=setup();
  const variants=[
    {Body:Buffer.from('synthetic corrupted bytes')},
    {Sha256:'a'.repeat(64)},
    {ContentLength:0},
    {Key:'demos/gdpr-erasure/v1/events/other/00000001.json'},
    {DeleteMarker:true},
    {IsLatest:false},
    {VersionId:''},
    {VersionId:'../bad'},
    {Body:'not-bytes'}
  ];
  for(const variant of variants) {
    const pages=pagesFor(journal);
    pages[0].objects[0]={...pages[0].objects[0],...variant};
    rejected(()=>verifySyntheticB2VersionInventory(journal,checkpoint,pages));
  }
});
test('pagination truncation, cursor mismatch, loop and unbounded page fail',()=>{
  const {journal,checkpoint}=setup();
  const original=pagesFor(journal);
  const cases=[
    [original[0]],
    [{...original[0],nextCursor:null}],
    [original[0],{...original[1],cursor:'wrong'}],
    [original[0],{...original[1],nextCursor:'page2'}],
    [original[0],{...original[1],nextCursor:'page3'}],
    [{cursor:null,nextCursor:'page2',objects:[]},original[1]],
    [{cursor:null,nextCursor:null,objects:Array(101).fill(original[0].objects[0])}]
  ];
  for(const pages of cases)
    rejected(()=>verifySyntheticB2VersionInventory(journal,checkpoint,pages));
});
test('stale or forged independent checkpoint never proves the version listing',()=>{
  const {journal,checkpoint}=setup();
  const pages=pagesFor(journal);
  assert.throws(()=>verifySyntheticB2VersionInventory(journal,
    {...checkpoint,count:checkpoint.count-1},pages),
    {code:'GDPR_MODEL_WITNESS_MISMATCH'});
  journal.witness.available=false;
  assert.throws(()=>verifySyntheticB2VersionInventory(journal,checkpoint,pages),
    {code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
});
test('valid object list cannot conceal altered journal or pending intent',()=>{
  const {journal,checkpoint}=setup();
  const pages=pagesFor(journal);
  journal.entries[1].operation.subject='bob'; // actual mutation, not the original Alice
  assert.throws(()=>verifySyntheticB2VersionInventory(journal,checkpoint,pages),
    {code:'GDPR_MODEL_CHAIN_INVALID'});
  const pending=new SyntheticExternalJournal();
  pending.prepare(operation('pending','alice'));
  rejected(()=>verifySyntheticB2VersionInventory(pending,
    pending.witness.current(),[{cursor:null,nextCursor:null,objects:[]}]));
});
test('empty witnessed and sealed epoch admits only an empty synthetic inventory',()=>{
  const journal=new SyntheticExternalJournal();
  journal.seal();
  const checkpoint=journal.witness.current();
  const empty=[{cursor:null,nextCursor:null,objects:[]}];
  assert.equal(verifySyntheticB2VersionInventory(journal,checkpoint,empty)
    .productionRecoveryReady,false);
  const fabricated=record(journal,{
    seq:1,epoch:journal.epoch,previous:'0'.repeat(64),
    phase:'prepare',operation:operation('x','alice'),hash:'f'.repeat(64)
  });
  rejected(()=>verifySyntheticB2VersionInventory(journal,checkpoint,
    [{cursor:null,nextCursor:null,objects:[fabricated]}]));
});
