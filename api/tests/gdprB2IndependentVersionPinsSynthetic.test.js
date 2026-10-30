'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {SyntheticExternalJournal,SyntheticDatabase,submitSyntheticOperation}=
  require('./fixtures/gdprDurableRecoveryPrototype');
const {keyFor,verifySyntheticB2VersionInventory}=
  require('./fixtures/gdprB2VersionInventorySynthetic');
const {BAD,SyntheticIndependentVersionPins,verifySyntheticPinnedB2Inventory}=
  require('./fixtures/gdprB2IndependentVersionPinsSynthetic');
const op=(id,subject,action='account_deleted')=>({id,subject,action});
const fail=fn=>assert.throws(fn,{code:BAD});
function setup(){
  const journal=new SyntheticExternalJournal();
  const db=new SyntheticDatabase({
    alice:{exists:true,consent:true},bob:{exists:true,consent:true}
  });
  submitSyntheticOperation(db,journal,op('delete-alice','alice'));
  submitSyntheticOperation(db,journal,op('revoke-bob','bob','political_consent_revoked'));
  journal.seal();
  const checkpoint=journal.witness.current();
  const records=journal.entries.map(entry=>{
    const Body=Buffer.from(JSON.stringify(entry));
    return {Key:keyFor(journal.epoch,entry.seq),
      VersionId:'synthetic-b2-version-'+entry.seq,
      ContentLength:Body.length,
      Sha256:crypto.createHash('sha256').update(Body).digest('hex'),
      Body,DeleteMarker:false,IsLatest:true};
  });
  const pages=[{cursor:null,nextCursor:null,objects:records}];
  const authority=new SyntheticIndependentVersionPins(journal.epoch);
  const pin=record=>({Key:record.Key,VersionId:record.VersionId,
    ContentLength:record.ContentLength,Sha256:record.Sha256});
  return {journal,checkpoint,pages,authority,pin};
}
function pinAll(fixture,transform=(pin)=>pin){
  for(const item of fixture.pages[0].objects)
    fixture.authority.acknowledge(transform(fixture.pin(item)));
  return fixture.authority.seal(fixture.journal,fixture.checkpoint);
}

test('independently pinned synthetic B2 versions pass without ever authorizing recovery',()=>{
  const f=setup(),receipt=pinAll(f);
  const result=verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,receipt);
  assert.equal(result.inspectedVersions,4);
  assert.equal(result.syntheticIndependentVersionPinsVerified,true);
  assert.equal(result.completeGdprJournalVerified,false);
  assert.equal(result.productionRecoveryReady,false);
  assert.equal(result.externalProviderAttested,false);
  assert.equal(result.isolatedRestoreVerified,false);
});

test('substituting a different version ID with identical bytes fools basic inventory but NOT independent pins',()=>{
  const f=setup(),receipt=pinAll(f);
  const forged=f.pages.map(page=>({...page,
    objects:page.objects.map(item=>({...item,Body:Buffer.from(item.Body)}))}));
  forged[0].objects[2].VersionId='synthetic-replacement-version';
  assert.equal(verifySyntheticB2VersionInventory(f.journal,f.checkpoint,forged)
    .syntheticInventoryVerified,true);
  fail(()=>verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,forged,f.authority,receipt));
});

test('wrong version pinned before seal cannot be repaired by rewriting inventory',()=>{
  const f=setup();
  const receipt=pinAll(f,p=>p.Key.endsWith('00000002.json')
    ? {...p,VersionId:'incorrect-version-id'} : p);
  fail(()=>verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,receipt));
});

test('mutating a signed pin receipt or replacing its signature fails closed',()=>{
  const f=setup(),receipt=pinAll(f);
  for(const forged of [
    {...receipt,pins:receipt.pins.map((p,i)=>i===1
      ? {...p,VersionId:'forged-version'} : p)},
    {...receipt,mac:'a'.repeat(64)},
    {...receipt,head:'f'.repeat(64)},
    {...receipt,count:receipt.count-1},
    {...receipt,pins:receipt.pins.slice(1)}
  ]) fail(()=>verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,forged));
  assert.equal(verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,receipt)
    .productionRecoveryReady,false);
});

test('pin receipts require sequential keys, unique versions and bounded metadata',()=>{
  for(const invalid of [
    {Key:'wrong'},
    {VersionId:'../bad'},
    {VersionId:''},
    {ContentLength:0},
    {ContentLength:4097},
    {Sha256:'wrong'},
    {Unexpected:'extra'}
  ]){
    const f=setup();
    const p={...f.pin(f.pages[0].objects[0]),...invalid};
    fail(()=>f.authority.acknowledge(p));
    assert.equal(f.authority.current(),null);
  }
  const f=setup();
  f.authority.acknowledge(f.pin(f.pages[0].objects[0]));
  const second=f.pin(f.pages[0].objects[1]);
  fail(()=>f.authority.acknowledge({...second,
    VersionId:f.pages[0].objects[0].VersionId}));
  fail(()=>f.authority.acknowledge(f.pin(f.pages[0].objects[3])));
  assert.equal(f.authority.acknowledge(second),2);
});

test('partial pin ledger, unsealed journal or post-seal append never authorizes admission',()=>{
  const f=setup();
  f.authority.acknowledge(f.pin(f.pages[0].objects[0]));
  fail(()=>f.authority.seal(f.journal,f.checkpoint));
  for(const item of f.pages[0].objects.slice(1))
    f.authority.acknowledge(f.pin(item));
  const receipt=f.authority.seal(f.journal,f.checkpoint);
  fail(()=>f.authority.acknowledge(f.pin(f.pages[0].objects[0])));
  fail(()=>f.authority.seal(f.journal,f.checkpoint));
  assert.equal(verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,receipt)
    .productionRecoveryReady,false);
  const unsealed=new SyntheticExternalJournal();
  const empty=new SyntheticIndependentVersionPins(unsealed.epoch);
  fail(()=>empty.seal(unsealed,unsealed.witness.current()));
});

test('independent pin authority unavailable or lost cannot be silently re-created',()=>{
  const f=setup(),receipt=pinAll(f);
  f.authority.available=false;
  fail(()=>verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,receipt));
  f.authority.available=true;
  f.authority.lose();
  fail(()=>verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,receipt));
  fail(()=>f.authority.seal(f.journal,f.checkpoint));
});

test('fresh checkpoint remains mandatory even with a valid independent pin receipt',()=>{
  const f=setup(),receipt=pinAll(f);
  assert.throws(()=>verifySyntheticPinnedB2Inventory(
    f.journal,{...f.checkpoint,head:'a'.repeat(64)},
    f.pages,f.authority,receipt),{code:'GDPR_MODEL_WITNESS_MISMATCH'});
  f.journal.witness.available=false;
  assert.throws(()=>verifySyntheticPinnedB2Inventory(
    f.journal,f.checkpoint,f.pages,f.authority,receipt),
    {code:'GDPR_MODEL_WITNESS_UNAVAILABLE'});
});
