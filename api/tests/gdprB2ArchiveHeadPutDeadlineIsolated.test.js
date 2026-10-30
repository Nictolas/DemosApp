'use strict';
// Exercises the actual DRAFT B2 exporter with an injected fake transport.
// No real B2 bucket, secrets, SQL, network, or production resources.
const test=require('node:test');
const assert=require('node:assert/strict');
const {PrivacyErasureB2Journal}=require('../services/privacyErasureB2Journal');
const NOW=new Date('2026-10-30T10:00:00.000Z');
const raw={
  event_key:'00000000-0000-4000-8000-000000000741',
  subject_user_id:'00000000-0000-4000-8000-000000000742',
  event_type:'account_deleted',occurred_at:'2026-10-30T09:00:00.000Z',
  details:{synthetic:true}
};
const env={
  GDPR_LEDGER_B2_ENABLED:'true',
  GDPR_LEDGER_B2_BUCKET:'gdpr-synthetic-head-put',
  GDPR_LEDGER_B2_REGION:'eu-central-003',
  GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
  GDPR_LEDGER_B2_ACCESS_KEY_ID:'synthetic-only',
  GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'synthetic-only',
  GDPR_LEDGER_B2_RETENTION_DAYS:'30',
  B2_BUCKET_NAME:'unrelated-log-bucket'
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(overrides={},timeout=20){
  const calls=[];
  let stored=null;
  const send=async(command,options)=>{
    const name=command.constructor.name;
    calls.push({name,input:command.input,options});
    if(overrides[name])return overrides[name](command,options,{stored,calls});
    if(name==='GetObjectLockConfigurationCommand')return {
      ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
        Rule:{DefaultRetention:{Mode:'COMPLIANCE',Days:30}}}
    };
    if(name==='HeadObjectCommand'){
      if(!stored)throw Object.assign(Error('synthetic missing'),{name:'NoSuchKey'});
      return {Metadata:stored.Metadata,ContentLength:stored.Body.length,
        VersionId:'synthetic-version-1'};
    }
    if(name==='PutObjectCommand'){
      stored=command.input;
      return {VersionId:'synthetic-version-1'};
    }
    if(name==='GetObjectRetentionCommand')return {
      Retention:{Mode:'COMPLIANCE',RetainUntilDate:stored.ObjectLockRetainUntilDate}
    };
    if(name==='GetObjectCommand')return {
      VersionId:'synthetic-version-1',
      ContentLength:stored.Body.length,
      ObjectLockMode:'COMPLIANCE',
      ObjectLockRetainUntilDate:stored.ObjectLockRetainUntilDate,
      Body:{async *[Symbol.asyncIterator](){yield stored.Body;}}
    };
    throw Error('UNEXPECTED_SYNTHETIC_OPERATION: '+name);
  };
  const client={send};
  const journal=new PrivacyErasureB2Journal({
    client,env,clock:()=>new Date(NOW),readbackTimeoutMs:timeout
  });
  return {journal,calls,client,stored:()=>stored};
}
const count=(f,name)=>f.calls.filter(c=>c.name===name).length;

test('a HEAD that never settles times out before any immutable PUT',async()=>{
  const f=fixture({HeadObjectCommand:()=>new Promise(()=>{})});
  await assert.rejects(f.journal.archiveEvent(raw),{
    message:'GDPR_B2_HEAD_TIMEOUT'
  });
  assert.equal(count(f,'PutObjectCommand'),0);
  assert.equal(f.journal.uncertainWrite,false);
  const head=f.calls.find(c=>c.name==='HeadObjectCommand');
  assert.ok(head.options.abortSignal.aborted);
});

test('a late HEAD 404 cannot start a PUT after the deadline',async()=>{
  let release;
  const f=fixture({HeadObjectCommand:()=>new Promise(resolve=>{release=resolve;})});
  await assert.rejects(f.journal.archiveEvent(raw),/GDPR_B2_HEAD_TIMEOUT/);
  release(Promise.reject(Object.assign(Error('late missing'),{name:'NoSuchKey'})));
  await sleep(5);
  assert.equal(count(f,'PutObjectCommand'),0);
});

test('a PUT with no acknowledgement times out and blocks same-instance retries',async()=>{
  const f=fixture({PutObjectCommand:()=>new Promise(()=>{})});
  await assert.rejects(f.journal.archiveEvent(raw),{
    message:'GDPR_B2_PUT_OUTCOME_UNKNOWN'
  });
  assert.equal(count(f,'PutObjectCommand'),1);
  assert.equal(f.journal.uncertainWrite,true);
  const before=f.calls.length;
  await assert.rejects(f.journal.archiveEvent(raw),
    /GDPR_B2_PUT_OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION/);
  assert.equal(f.calls.length,before);
  assert.ok(f.calls.find(c=>c.name==='PutObjectCommand')
    .options.abortSignal.aborted);
});

test('late successful PUT ACK never triggers a version readback or retry',async()=>{
  let release;
  const f=fixture({PutObjectCommand:()=>new Promise(resolve=>{release=resolve;})});
  await assert.rejects(f.journal.archiveEvent(raw),/GDPR_B2_PUT_OUTCOME_UNKNOWN/);
  release({VersionId:'synthetic-version-1'});
  await sleep(5);
  assert.equal(count(f,'PutObjectCommand'),1);
  assert.equal(count(f,'GetObjectRetentionCommand'),0);
  assert.equal(count(f,'GetObjectCommand'),0);
  assert.equal(f.journal.uncertainWrite,true);
});

test('a provider error after a potentially committed PUT remains ambiguous',async()=>{
  const f=fixture({PutObjectCommand:()=>Promise.reject(Error('synthetic lost ACK'))});
  await assert.rejects(f.journal.archiveEvent(raw),/synthetic lost ACK/);
  assert.equal(f.journal.uncertainWrite,true);
  await assert.rejects(f.journal.archiveEvent({...raw,
    event_key:'00000000-0000-4000-8000-000000000743'}),
    /REQUIRES_RECONCILIATION/);
  assert.equal(count(f,'PutObjectCommand'),1);
});

test('successful PUT with failed version readback stays quarantined',async()=>{
  const f=fixture({GetObjectRetentionCommand:()=>Promise.reject(Error('synthetic retention unavailable'))});
  await assert.rejects(f.journal.archiveEvent(raw),/synthetic retention unavailable/);
  assert.equal(f.journal.uncertainWrite,true);
  assert.equal(count(f,'PutObjectCommand'),1);
  await assert.rejects(f.journal.archiveEvent(raw),/REQUIRES_RECONCILIATION/);
  assert.equal(count(f,'PutObjectCommand'),1);
});

test('fully verified PUT clears latch; later HEAD reuse avoids duplicate versions',async()=>{
  const f=fixture();
  const first=await f.journal.archiveEvent(raw);
  assert.equal(first.reused,false);
  assert.equal(first.versionId,'synthetic-version-1');
  assert.equal(f.journal.uncertainWrite,false);
  const second=await f.journal.archiveEvent(raw);
  assert.equal(second.reused,true);
  assert.equal(count(f,'PutObjectCommand'),1);
  assert.equal(count(f,'HeadObjectCommand'),2);
  assert.ok(f.calls.filter(c=>['HeadObjectCommand','PutObjectCommand'].includes(c.name))
    .every(c=>c.options.abortSignal.aborted));
});

test('PUT timeout cannot be silently extended beyond the configured bound',async()=>{
  const f=fixture({PutObjectCommand:()=>new Promise(()=>{})},5);
  const started=Date.now();
  await assert.rejects(f.journal.archiveEvent(raw),/GDPR_B2_PUT_OUTCOME_UNKNOWN/);
  assert.ok(Date.now()-started<1500,'local timeout must not hang indefinitely');
  assert.equal(count(f,'PutObjectCommand'),1);
});

test('SDK-level automatic retries are disabled for non-idempotent uploads',async()=>{
  const journal=new PrivacyErasureB2Journal({env});
  const sdk=journal.s3(journal.config());
  assert.equal(await sdk.config.maxAttempts(),1);
  sdk.destroy();
});
