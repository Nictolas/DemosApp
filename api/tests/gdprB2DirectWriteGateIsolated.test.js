'use strict';
// TEST ONLY: exercises the actual Draft exporter with a wholly fake client.
// No Backblaze, credentials, SQL, PII or production network operations.
const test=require('node:test');
const assert=require('node:assert/strict');
const {S3Client}=require('@aws-sdk/client-s3');
const {PrivacyErasureB2Journal}=require('../services/privacyErasureB2Journal');

const event=(n='701')=>({
  event_key:'00000000-0000-4000-8000-000000000'+n,
  subject_user_id:'00000000-0000-4000-8000-000000000799',
  event_type:'account_deleted',occurred_at:'2026-10-30T10:00:00.000Z',
  details:{synthetic:true}
});
const env={
  GDPR_LEDGER_B2_ENABLED:'true',
  GDPR_LEDGER_B2_BUCKET:'synthetic-gdpr-b2-direct-gate',
  GDPR_LEDGER_B2_REGION:'eu-central-003',
  GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
  GDPR_LEDGER_B2_ACCESS_KEY_ID:'fixture-only',
  GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'fixture-only',
  GDPR_LEDGER_B2_RETENTION_DAYS:'30',
  B2_BUCKET_NAME:'unrelated-log-bucket'
};
const now=new Date('2026-10-30T11:00:00.000Z');

test('default exporter refuses DIRECT archiveEvent before constructing a real S3 client',async()=>{
  const journal=new PrivacyErasureB2Journal({env,clock:()=>new Date(now)});
  await assert.rejects(journal.archiveEvent(event()),{
    message:'GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED'
  });
  assert.equal(journal.client,null);
  assert.equal(journal.writeInProgress,undefined);
  assert.equal(journal.uncertainWrite,false);
});

test('explicitly injected real AWS S3Client cannot turn the direct path into a PUT',async()=>{
  const sdk=new S3Client({
    region:'eu-central-003',
    credentials:{accessKeyId:'synthetic',secretAccessKey:'synthetic'}
  });
  let calls=0;
  sdk.send=()=>{calls++;throw Error('UNEXPECTED_NETWORK');};
  try{
    const journal=new PrivacyErasureB2Journal({env,client:sdk});
    await assert.rejects(journal.archiveEvent(event()),{
      message:'GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED'
    });
    assert.equal(calls,0);
  }finally{sdk.destroy();}
});

test('direct archiveBatch refuses real client before querying SQL',async()=>{
  const journal=new PrivacyErasureB2Journal({env});
  let reads=0;
  const fakeDb={query(){reads++;throw Error('UNEXPECTED_SQL');}};
  await assert.rejects(journal.archiveBatch(fakeDb),{
    message:'GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED'
  });
  assert.equal(reads,0);
  assert.equal(journal.client,null);
});

test('same-process overlapping operations are rejected BEFORE both can see HEAD=404',async()=>{
  let release;
  let waiting;
  const entered=new Promise(resolve=>{waiting=resolve;});
  const calls=[];
  const client={
    async send(cmd) {
      const name=cmd.constructor.name;
      calls.push(name);
      if(name==='GetObjectLockConfigurationCommand') {
        waiting();
        await new Promise(resolve=>{release=resolve;});
        return {ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
          Rule:{DefaultRetention:{Mode:'COMPLIANCE',Days:30}}}};
      }
      if(name==='HeadObjectCommand') {
        throw Object.assign(Error('synthetic object not found'),{name:'NoSuchKey'});
      }
      if(name==='PutObjectCommand') {
        return {VersionId:'synthetic-v1'};
      }
      if(name==='GetObjectRetentionCommand') {
        return {Retention:{Mode:'COMPLIANCE',
          RetainUntilDate:new Date('2026-12-31T10:00:00.000Z')}};
      }
      if(name==='GetObjectCommand') {
        const bytes=Buffer.from(JSON.stringify(require(
          '../services/privacyErasureB2Journal').normalizeEvent(event())));
        return {VersionId:'synthetic-v1',ContentLength:bytes.length,
          ObjectLockMode:'COMPLIANCE',
          ObjectLockRetainUntilDate:new Date('2026-12-31T10:00:00.000Z'),
          Body:{async *[Symbol.asyncIterator](){yield bytes;}}};
      }
      throw Error('UNEXPECTED_COMMAND: '+name);
    }
  };
  const journal=new PrivacyErasureB2Journal({
    env,client,clock:()=>new Date(now),readbackTimeoutMs:500
  });
  const first=journal.archiveEvent(event());
  await entered;
  assert.equal(journal.writeInProgress,true);
  await assert.rejects(journal.archiveEvent(event('702')),{
    message:'GDPR_B2_CONCURRENT_ARCHIVE_NOT_ALLOWED'
  });
  assert.deepEqual(calls,['GetObjectLockConfigurationCommand']);
  release();
  const receipt=await first;
  assert.equal(receipt.reused,false);
  assert.equal(receipt.versionId,'synthetic-v1');
  assert.equal(calls.filter(x=>x==='PutObjectCommand').length,1);
  assert.equal(journal.writeInProgress,false);
  assert.equal(journal.uncertainWrite,false);
});

test('pre-PUT failure clears the in-process gate for a safe subsequent attempt',async()=>{
  const calls=[];
  let callsToLock=0;
  const client={async send(cmd) {
    const name=cmd.constructor.name;calls.push(name);
    if(name==='GetObjectLockConfigurationCommand') {
      callsToLock++;
      if(callsToLock===1) throw Error('synthetic preflight outage');
      return {ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
        Rule:{DefaultRetention:{Mode:'COMPLIANCE',Days:30}}}};
    }
    if(name==='HeadObjectCommand') {
      throw Error('synthetic HEAD transport unavailable');
    }
    throw Error('UNEXPECTED_COMMAND: '+name);
  }};
  const journal=new PrivacyErasureB2Journal({env,client,readbackTimeoutMs:100});
  await assert.rejects(journal.archiveEvent(event()),/preflight outage/);
  assert.equal(journal.writeInProgress,false);
  assert.equal(journal.uncertainWrite,false);
  await assert.rejects(journal.archiveEvent(event()),/HEAD transport unavailable/);
  assert.equal(journal.writeInProgress,false);
  assert.equal(journal.uncertainWrite,false);
  assert.equal(calls.includes('PutObjectCommand'),false);
});

test('uncertain PUT outcome remains sticky even after in-flight gate is released',async()=>{
  const calls=[];
  const client={async send(cmd){
    const name=cmd.constructor.name;calls.push(name);
    if(name==='GetObjectLockConfigurationCommand') return {
      ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
        Rule:{DefaultRetention:{Mode:'COMPLIANCE',Days:30}}}
    };
    if(name==='HeadObjectCommand')
      throw Object.assign(Error('synthetic absence'),{name:'NoSuchKey'});
    if(name==='PutObjectCommand')throw Error('synthetic lost acknowledgement');
    throw Error('UNEXPECTED_COMMAND');
  }};
  const journal=new PrivacyErasureB2Journal({env,client,readbackTimeoutMs:100});
  await assert.rejects(journal.archiveEvent(event()),/lost acknowledgement/);
  assert.equal(journal.writeInProgress,false);
  assert.equal(journal.uncertainWrite,true);
  const count=calls.length;
  await assert.rejects(journal.archiveEvent(event()),{
    message:'GDPR_B2_PUT_OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION'
  });
  assert.equal(calls.length,count);
});

test('empty SQL archive cursor page never claims journal completeness',async()=>{
  let reads=0,network=0;
  const journal=new PrivacyErasureB2Journal({env,client:{
    send(){network++;throw Error('UNEXPECTED_PROVIDER_IO');}
  }});
  const db={async query(){reads++;return {rows:[{
    complete_visibility:true,event_key:null
  }]};}};
  const result=await journal.archiveBatch(db);
  assert.deepEqual(result,{exported:0,cursor:null,
    complete:false,recoveryReady:false});
  assert.equal(reads,1);
  assert.equal(network,0);
});
