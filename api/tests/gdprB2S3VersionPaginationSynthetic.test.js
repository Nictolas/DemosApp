'use strict';
// Mock S3 ListObjectVersions metadata, NO S3 networking and NO real bucket.
const test=require('node:test');
const assert=require('node:assert/strict');
const {SyntheticExternalJournal,SyntheticDatabase,submitSyntheticOperation}=
  require('./fixtures/gdprDurableRecoveryPrototype');
const {keyFor}=require('./fixtures/gdprB2VersionInventorySynthetic');
const {SyntheticIndependentVersionPins}=
  require('./fixtures/gdprB2IndependentVersionPinsSynthetic');
const {BAD,verifySyntheticS3VersionPagination:verify}=
  require('./fixtures/gdprB2S3VersionPaginationSynthetic');
const crypto=require('node:crypto');
const BUCKET='synthetic-gdpr-attestation';
const op=(id,subject,action)=>({id,subject,action});
function fixture(){
  const journal=new SyntheticExternalJournal();
  const db=new SyntheticDatabase({alice:{exists:true,consent:true},
    bob:{exists:true,consent:true}});
  submitSyntheticOperation(db,journal,
    op('revoke-a','alice','political_consent_revoked'));
  submitSyntheticOperation(db,journal,op('delete-b','bob','account_deleted'));
  journal.seal();
  const checkpoint=journal.witness.current();
  const authority=new SyntheticIndependentVersionPins(journal.epoch);
  const versions=journal.entries.map(e=>{
    const b=Buffer.from(JSON.stringify(e));
    const pinned={Key:keyFor(journal.epoch,e.seq),
      VersionId:'synthetic-version-'+e.seq,
      ContentLength:b.length,
      Sha256:crypto.createHash('sha256').update(b).digest('hex')};
    authority.acknowledge(pinned);
    return {Key:pinned.Key,VersionId:pinned.VersionId,
      Size:pinned.ContentLength,IsLatest:true};
  });
  const pinReceipt=authority.seal(journal,checkpoint);
  const prefix='demos/gdpr-erasure/v1/events/'+journal.epoch+'/';
  const first={Name:BUCKET,Prefix:prefix,MaxKeys:2,
    KeyMarker:null,VersionIdMarker:null,
    IsTruncated:true,
    NextKeyMarker:versions[1].Key,NextVersionIdMarker:versions[1].VersionId,
    Versions:versions.slice(0,2),DeleteMarkers:[]};
  const second={...first,
    KeyMarker:first.NextKeyMarker,VersionIdMarker:first.NextVersionIdMarker,
    IsTruncated:false,NextKeyMarker:null,NextVersionIdMarker:null,
    Versions:versions.slice(2)};
  return {journal,checkpoint,authority,pinReceipt,
    approvedBucket:BUCKET,pages:[first,second],maxKeys:2};
}
const rejected=input=>assert.throws(()=>verify(input),{code:BAD});

test('two S3-shaped pages with paired key and version markers match independent pins; never GO',()=>{
  const f=fixture(),result=verify(f);
  assert.equal(result.syntheticS3VersionPaginationVerified,true);
  assert.equal(result.inspectedPages,2);
  assert.equal(result.inspectedVersions,4);
  for(const name of ['productionRecoveryReady','externalProviderAttested',
    'completeGdprJournalVerified','perVersionRetentionVerified',
    'isolatedRestoreVerified'])assert.equal(result[name],false);
});
test('missing final page must not be mistaken for complete provider inventory',()=>{
  const f=fixture();f.pages.pop();rejected(f);
});
test('incorrect IsTruncated or terminal continuation markers fail closed',()=>{
  for(const edit of [
    f=>{f.pages[0].IsTruncated=false;},
    f=>{f.pages[1].IsTruncated=true;},
    f=>{f.pages[1].NextKeyMarker=f.pages[0].NextKeyMarker;},
    f=>{f.pages[1].NextVersionIdMarker=f.pages[0].NextVersionIdMarker;}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('both paired markers are required when truncation is declared',()=>{
  for(const edit of [
    f=>{f.pages[0].NextKeyMarker=null;},
    f=>{f.pages[0].NextVersionIdMarker=null;},
    f=>{f.pages[1].KeyMarker='different-key';},
    f=>{f.pages[1].VersionIdMarker='other-version';}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('duplicate or repeated cursor pages do not pass pagination',()=>{
  for(const edit of [
    f=>{f.pages[1].KeyMarker=null;f.pages[1].VersionIdMarker=null;},
    f=>{f.pages[0].NextKeyMarker='same';f.pages[0].NextVersionIdMarker='v1';
      f.pages[1].KeyMarker='same';f.pages[1].VersionIdMarker='v1';
      f.pages[1].NextKeyMarker='same';f.pages[1].NextVersionIdMarker='v1';
      f.pages[1].IsTruncated=true;},
    f=>{f.pages[1].Versions=f.pages[0].Versions;}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('delete marker under the approved GDPR prefix is a NO-GO even when version rows match',()=>{
  const f=fixture();f.pages[0].DeleteMarkers=[{
    Key:f.pages[0].Versions[0].Key,VersionId:'hidden-deletion-v2'}];
  rejected(f);
});
test('unlisted noncurrent object version or nonlatest pinned version is a NO-GO',()=>{
  for(const edit of [
    f=>{f.pages[0].Versions[0].IsLatest=false;},
    f=>{f.pages[0].Versions.unshift({
      ...f.pages[0].Versions[0],VersionId:'old-object-version',IsLatest:false});}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('additional unpinned version of a known key cannot silently pass',()=>{
  const f=fixture();f.pages[1].Versions[1]={
    ...f.pages[1].Versions[1],VersionId:'unregistered-version'};
  rejected(f);
});
test('version metadata Size and VersionId must match independent pin receipt exactly',()=>{
  for(const edit of [
    f=>{f.pages[0].Versions[0].Size++;},
    f=>{f.pages[0].Versions[0].Size='200';},
    f=>{f.pages[1].Versions[0].VersionId='another';},
    f=>{f.pages[1].Versions[1].VersionId=null;}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('wrong bucket, prefix and extra provider response envelope fail closed',()=>{
  for(const edit of [
    f=>{f.pages[0].Name='synthetic-other-bucket';},
    f=>{f.pages[1].Prefix='demos/axiom-archive/v1/';},
    f=>{f.pages[0].MaxKeys=1000;},
    f=>{f.pages[0].Delimiter='/';},
    f=>{f.pages[0].Versions[0].ETag='md5-not-sha256';}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('missing version, reordered keys or empty truncated pages fail closed',()=>{
  for(const edit of [
    f=>{f.pages[1].Versions.pop();},
    f=>{f.pages[0].Versions.reverse();},
    f=>{f.pages[0].Versions=[];}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('lost pin authority, stale witness or counterfeit signature cannot prove completeness',()=>{
  for(const edit of [
    f=>{f.authority.available=false;},
    f=>{f.journal.witness.available=false;},
    f=>{f.pinReceipt.mac='a'.repeat(64);},
    f=>{f.checkpoint.head='a'.repeat(64);}
  ]){const f=fixture();edit(f);rejected(f);}
});
test('bounded pagination and exact page shape are mandatory',()=>{
  for(const edit of [
    f=>{f.maxKeys=0;},
    f=>{f.maxKeys=101;},
    f=>{f.pages[0].DeleteMarkers=null;},
    f=>{f.pages=[];},
    f=>{f.pages=Array(65).fill(f.pages[0]);},
    f=>{f.pages[1].Versions[0].Key='demos/axiom-archive/v1/bad';}
  ]){const f=fixture();edit(f);rejected(f);}
});

test('forged but consistently echoed continuation cursor cannot claim a complete scan',()=>{
  for(const edit of [
    f=>{f.pages[0].NextKeyMarker='fabricated-key';
      f.pages[0].NextVersionIdMarker='fabricated-version';},
    f=>{f.pages[0].NextKeyMarker=f.pages[0].Versions[0].Key;
      f.pages[0].NextVersionIdMarker=f.pages[0].Versions[0].VersionId;},
    f=>{f.pages[0].NextVersionIdMarker='other-version';}
  ]){
    const f=fixture();edit(f);
    // An attacker can echo the same false cursor in the next request:
    // prior validation only compared the two envelopes and accepted it.
    f.pages[1].KeyMarker=f.pages[0].NextKeyMarker;
    f.pages[1].VersionIdMarker=f.pages[0].NextVersionIdMarker;
    rejected(f);
  }
});
