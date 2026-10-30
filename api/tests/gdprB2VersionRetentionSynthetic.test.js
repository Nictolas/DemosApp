'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {SyntheticExternalJournal,SyntheticDatabase,submitSyntheticOperation}=
  require('./fixtures/gdprDurableRecoveryPrototype');
const {keyFor}=require('./fixtures/gdprB2VersionInventorySynthetic');
const {SyntheticIndependentVersionPins}=
  require('./fixtures/gdprB2IndependentVersionPinsSynthetic');
const {BAD,verifySyntheticPinnedB2VersionRetention}=
  require('./fixtures/gdprB2VersionRetentionSynthetic');

const BUCKET='demos-gdpr-synthetic-attestation';
const START=new Date('2026-10-30T12:00:00.000Z');
const END=new Date('2026-10-30T12:00:01.000Z');
const UNTIL='2026-11-15T12:00:00.000Z';
const reject=fn=>assert.throws(fn,{code:BAD});
const op=(id,subject,action='account_deleted')=>({id,subject,action});

function setup() {
  const journal=new SyntheticExternalJournal();
  const db=new SyntheticDatabase({alice:{exists:true,consent:true},
    bob:{exists:true,consent:true}});
  submitSyntheticOperation(db,journal,op('delete-alice','alice'));
  submitSyntheticOperation(db,journal,op('revoke-bob','bob','political_consent_revoked'));
  journal.seal();
  const checkpoint=journal.witness.current();
  const versions=journal.entries.map(entry=>{
    const Body=Buffer.from(JSON.stringify(entry));
    return {Key:keyFor(journal.epoch,entry.seq),
      VersionId:'synthetic-version-'+entry.seq,
      ContentLength:Body.length,
      Sha256:crypto.createHash('sha256').update(Body).digest('hex'),
      Body,DeleteMarker:false,IsLatest:true};
  });
  const pages=[
    {cursor:null,nextCursor:'page2',objects:versions.slice(0,2)},
    {cursor:'page2',nextCursor:null,objects:versions.slice(2)}
  ];
  const authority=new SyntheticIndependentVersionPins(journal.epoch);
  for(const v of versions) authority.acknowledge({
    Key:v.Key,VersionId:v.VersionId,
    ContentLength:v.ContentLength,Sha256:v.Sha256
  });
  const pinReceipt=authority.seal(journal,checkpoint);
  const retentions=versions.map(v=>({
    Bucket:BUCKET,Key:v.Key,VersionId:v.VersionId,
    Mode:'COMPLIANCE',RetainUntilDate:UNTIL
  }));
  return {journal,checkpoint,pages,authority,pinReceipt,retentions,
    approvedBucket:BUCKET,startedAt:START,endedAt:END,minimumRemainingDays:7};
}
function verify(data){return verifySyntheticPinnedB2VersionRetention(data);}

test('all independently pinned synthetic versions have COMPLIANCE retention; still NO-GO',()=>{
  const r=verify(setup());
  assert.equal(r.inspectedRetentions,4);
  assert.equal(r.syntheticPerVersionComplianceRetentionVerified,true);
  assert.equal(r.syntheticIndependentVersionPinsVerified,true);
  assert.equal(r.productionRecoveryReady,false);
  assert.equal(r.completeGdprJournalVerified,false);
  assert.equal(r.externalProviderAttested,false);
  assert.equal(r.isolatedRestoreVerified,false);
});
test('a missing, extra, reordered or duplicate retention reply fails closed',()=>{
  for(const variant of [
    rows=>rows.slice(1),
    rows=>rows.slice(0,-1),
    rows=>[...rows,rows[0]],
    rows=>[rows[1],rows[0],...rows.slice(2)],
    rows=>[rows[0],rows[0],...rows.slice(2)]
  ]){
    const f=setup();f.retentions=variant(f.retentions);
    reject(()=>verify(f));
  }
});
test('COMPLIANCE lock must match exact pinned version, key and approved bucket',()=>{
  for(const patch of [
    {Mode:'GOVERNANCE'}, {Mode:'none'}, {Mode:null},
    {Bucket:'demos-log-archive-eu'},
    {Key:'demos/gdpr-erasure/v1/events/other/00000001.json'},
    {VersionId:'different-synthetic-version'},
    {VersionId:''}
  ]) {
    const f=setup();f.retentions[0]={...f.retentions[0],...patch};
    reject(()=>verify(f));
  }
});
test('expired, near-expiring and exactly-at-threshold versions fail',()=>{
  const f=setup();
  const end=END.getTime();
  for(const until of [
    new Date(end-1).toISOString(),
    new Date(end+86400000).toISOString(),
    new Date(end+7*86400000).toISOString()
  ]) {
    const changed=setup();
    changed.retentions[3].RetainUntilDate=until;
    reject(()=>verify(changed));
  }
  assert.equal(f.retentions.length,4);
});
test('malformed, noncanonical and impossible retention dates fail',()=>{
  for(const value of [
    'invalid','2026-02-30T12:00:00.000Z',
    '2026-11-15T12:00:00Z',
    '2026-11-15T13:00:00.000+01:00',
    '2026-11-15','2026-11-15T12:00:00.000',
    null,1234
  ]) {
    const f=setup();f.retentions[1].RetainUntilDate=value;
    reject(()=>verify(f));
  }
});
test('strict schema, no extra metadata, and bounded batch size',()=>{
  for(const patch of [{Extra:'secret'}, {Key:undefined}, {Mode:undefined}]) {
    const f=setup();f.retentions[2]={...f.retentions[2],...patch};
    reject(()=>verify(f));
  }
  for(const bad of [null,{},'not-array',new Array(513).fill({})]) {
    const f=setup();f.retentions=bad;reject(()=>verify(f));
  }
});
test('invalid, reversed or stale clocks and invalid retention policy fail closed',()=>{
  for(const patch of [
    {startedAt:new Date('invalid')},
    {endedAt:new Date('invalid')},
    {startedAt:END,endedAt:START},
    {endedAt:new Date(START.getTime()+600001)},
    {startedAt:'2026-10-30T12:00:00Z'},
    {minimumRemainingDays:0},
    {minimumRemainingDays:3001},
    {minimumRemainingDays:1.5},
    {approvedBucket:'bad bucket'}
  ]) reject(()=>verify({...setup(),...patch}));
});
test('pin substitution or manipulated journal still denies all-version retention',()=>{
  const f=setup();
  f.pages[1].objects[0]={...f.pages[1].objects[0],
    VersionId:'synthetic-replacement'};
  // Retention reply can lie consistently about the replacement too;
  // the independent pin still prevents a false acceptance.
  f.retentions[2].VersionId='synthetic-replacement';
  reject(()=>verify(f));
  const altered=setup();
  altered.journal.entries[1].operation.subject='bob';
  reject(()=>verify(altered));
});
test('independent pin or witness outage makes every positive retention response useless',()=>{
  const f=setup();f.authority.available=false;
  reject(()=>verify(f));
  const g=setup();g.journal.witness.available=false;
  reject(()=>verify(g));
  const h=setup();h.authority.lose();
  reject(()=>verify(h));
});
test('empty sealed journal permits only empty synthetic retention evidence',()=>{
  const journal=new SyntheticExternalJournal();
  journal.seal();
  const checkpoint=journal.witness.current();
  const authority=new SyntheticIndependentVersionPins(journal.epoch);
  const pinReceipt=authority.seal(journal,checkpoint);
  const f={journal,checkpoint,pages:[{cursor:null,nextCursor:null,objects:[]}],
    authority,pinReceipt,retentions:[],approvedBucket:BUCKET,
    startedAt:START,endedAt:END,minimumRemainingDays:7};
  assert.equal(verify(f).inspectedRetentions,0);
  reject(()=>verify({...f,retentions:[{Bucket:BUCKET,Key:'fake',
    VersionId:'fake',Mode:'COMPLIANCE',RetainUntilDate:UNTIL}]}));
});
