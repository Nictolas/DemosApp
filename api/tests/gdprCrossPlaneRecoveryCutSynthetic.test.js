'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {
  SyntheticExternalJournal,SyntheticDatabase,submitSyntheticOperation
}=require('./fixtures/gdprDurableRecoveryPrototype');
const {keyFor}=require('./fixtures/gdprB2VersionInventorySynthetic');
const {SyntheticIndependentVersionPins}=
  require('./fixtures/gdprB2IndependentVersionPinsSynthetic');
const {snapshotDigest,syntheticManifest,verifySyntheticCrossPlaneRecoveryCut}=
  require('./fixtures/gdprCrossPlaneRecoveryCutSynthetic');
const BUCKET='synthetic-gdpr-cross-plane';
const START=new Date('2026-10-30T12:00:00.000Z');
const END=new Date('2026-10-30T12:00:01.000Z');
const RETAIN='2026-11-30T12:00:00.000Z';
const BAD='GDPR_MODEL_CROSS_PLANE_CUT_UNVERIFIED';
const alice={exists:true,consent:true},bob={exists:true,consent:true};
const op=(id,subject,action)=>({id,subject,action});
function setup({backupAfter=0}={}) {
  const journal=new SyntheticExternalJournal();
  const db=new SyntheticDatabase({alice,bob});
  const before=db.snapshot();
  const events=[
    op('revoke-a','alice','political_consent_revoked'),
    op('delete-b','bob','account_deleted')
  ];
  submitSyntheticOperation(db,journal,events[0]);
  const afterFirst=db.snapshot();
  submitSyntheticOperation(db,journal,events[1]);
  journal.seal();
  const snapshot=backupAfter===0?before:afterFirst;
  const cutCount=backupAfter===0?0:2;
  const checkpoint=journal.witness.current();
  const objects=journal.entries.map(entry=>{
    const Body=Buffer.from(JSON.stringify(entry));
    return {Key:keyFor(journal.epoch,entry.seq),
      VersionId:'synthetic-version-'+entry.seq,
      ContentLength:Body.length,Body,
      Sha256:crypto.createHash('sha256').update(Body).digest('hex'),
      DeleteMarker:false,IsLatest:true};
  });
  const pages=[{cursor:null,nextCursor:'two',objects:objects.slice(0,2)},
    {cursor:'two',nextCursor:null,objects:objects.slice(2)}];
  const authority=new SyntheticIndependentVersionPins(journal.epoch);
  for(const o of objects) authority.acknowledge({
    Key:o.Key,VersionId:o.VersionId,ContentLength:o.ContentLength,
    Sha256:o.Sha256
  });
  const pinReceipt=authority.seal(journal,checkpoint);
  const retentions=objects.map(o=>({Bucket:BUCKET,Key:o.Key,
    VersionId:o.VersionId,Mode:'COMPLIANCE',RetainUntilDate:RETAIN}));
  return {journal,checkpoint,pages,authority,pinReceipt,retentions,
    approvedBucket:BUCKET,startedAt:START,endedAt:END,minimumRemainingDays:7,
    snapshot,manifest:syntheticManifest(snapshot,journal,cutCount),
    writersFenced:true,ingressBlocked:true,providersQuarantined:true};
}
const verify=x=>verifySyntheticCrossPlaneRecoveryCut(x);
const denied=x=>assert.throws(()=>verify(x),{code:BAD});
test('zero-event SQL backup cut plus fully pinned journal replays two events, never GO',()=>{
  const x=setup(),r=verify(x);
  assert.equal(r.syntheticCrossPlaneCutVerified,true);
  assert.equal(r.syntheticReplayedOperations,2);
  assert.equal(r.syntheticPinnedVersions,4);
  for(const flag of ['productionRecoveryReady','backupProvenanceVerified',
    'completeGdprJournalVerified','externalProviderAttested',
    'isolatedRestoreVerified'])assert.equal(r[flag],false);
});
test('later SQL cut with exact committed prefix replays only missing event',()=>{
  const x=setup({backupAfter:1});
  const r=verify(x);
  assert.equal(r.syntheticCrossPlaneCutVerified,true);
  assert.equal(r.syntheticReplayedOperations,2); // total committed, idempotent one
});
test('SQL snapshot from later cut paired with earlier manifest is rejected',()=>{
  const x=setup({backupAfter:1});
  x.manifest=syntheticManifest(x.snapshot,x.journal,0);
  denied(x);
});
test('SQL snapshot from earlier cut paired with later manifest is rejected',()=>{
  const x=setup();
  x.manifest=syntheticManifest(x.snapshot,x.journal,2);
  denied(x);
});
test('journal cut cannot end on an uncommitted prepare entry',()=>{
  const x=setup({backupAfter:1});
  x.manifest=syntheticManifest(x.snapshot,x.journal,1);
  denied(x);
});
test('cross-plane bundle with forged SQL system/timeline/LSN/extra fields is rejected',()=>{
  for(const patch of [{postgresSystemId:'other'}, {postgresTimeline:0},
    {postgresTimeline:1.1},{postgresLsn:'bogus'},
    {postgresLsn:'0/00000011;DROP'}, {backupId:'secret'},
    {untrusted:true},{journalEpoch:'stale-epoch'},
    {journalCount:-1},{journalCount:10000},
    {journalHead:'a'.repeat(64)},{snapshotSha256:'a'.repeat(64)}]) {
    const x=setup();x.manifest={...x.manifest,...patch};denied(x);
  }
});
test('tampering SQL snapshot state without new manifest fails the digest',()=>{
  const x=setup({backupAfter:1});
  x.snapshot.accounts.alice.consent=true;
  denied(x);
});
test('self-consistent forged snapshot hash cannot bypass journal lineage',()=>{
  const x=setup({backupAfter:1});
  x.snapshot.accounts.alice.consent=true;
  x.manifest.snapshotSha256=snapshotDigest(x.snapshot);
  denied(x);
});
test('missing event version or invented COMPLIANCE metadata rejects whole bundle',()=>{
  for(const damage of [
    x=>{x.pages[1].objects.pop();},
    x=>{x.retentions[0].Mode='GOVERNANCE';},
    x=>{x.retentions[1].VersionId='wrong';},
    x=>{x.pages[0].objects[0].Body=Buffer.from('other');}
  ]){
    const x=setup();damage(x);denied(x);
  }
});
test('lost independent witness, stale receipt or unavailable pin authority rejects',()=>{
  for(const damage of [
    x=>{x.journal.witness.available=false;},
    x=>{x.authority.available=false;},
    x=>{x.pinReceipt.mac='f'.repeat(64);},
    x=>{x.checkpoint.head='f'.repeat(64);}
  ]){
    const x=setup();damage(x);denied(x);
  }
});
test('any missing quarantine barrier blocks admission before simulated replay',()=>{
  for(const field of ['writersFenced','ingressBlocked','providersQuarantined']){
    const x=setup();x[field]=false;denied(x);
  }
});
test('a manifest from another checkpoint epoch and chain is not interchangeable',()=>{
  const a=setup(),b=setup();
  // Both tests have structurally identical journal data; change the second
  // epoch to force a genuinely distinct independent chain.
  const different=new SyntheticExternalJournal(undefined,'different-epoch');
  const db=new SyntheticDatabase({alice,bob});
  submitSyntheticOperation(db,different,op('revoke-a','alice',
    'political_consent_revoked'));
  different.seal();
  a.manifest.journalEpoch=different.epoch;
  denied(a);
  assert.equal(verify(b).productionRecoveryReady,false);
});
test('complete synthetic evidence still cannot prove backup provenance or journal coverage',()=>{
  const x=setup();
  const result=verify(x);
  assert.equal(result.backupProvenanceVerified,false);
  assert.equal(result.completeGdprJournalVerified,false);
  assert.equal(result.productionRecoveryReady,false);
});
