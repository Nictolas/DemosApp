'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  GetBucketVersioningCommand,GetObjectLockConfigurationCommand,
  PutObjectCommand,GetObjectCommand,ListObjectVersionsCommand
}=require('@aws-sdk/client-s3');
const {
  MARKER,BAD,CLOSED,assertSafeEnvironment,readOnlyTransport,
  runReadOnlyBucketProbe,MAX_PROBE_MS
}=require('../scripts/attest-gdpr-b2-bucket-readonly');

const base=()=>({
  GDPR_B2_METADATA_PROBE:MARKER,
  GDPR_B2_READONLY_BUCKET:'demos-gdpr-erasure-ci-only',
  GDPR_B2_READONLY_APPROVED_BUCKET:'demos-gdpr-erasure-ci-only',
  GDPR_B2_READONLY_REGION:'eu-central-003',
  GDPR_B2_READONLY_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
  GDPR_B2_READONLY_ACCESS_KEY_ID:'synthetic-metadata-reader-id',
  GDPR_B2_READONLY_SECRET_ACCESS_KEY:'synthetic-metadata-reader-secret',
  GDPR_B2_READONLY_MIN_RETENTION_DAYS:'30',
  B2_BUCKET_NAME:'demos-log-archive-eu'
});
function fake({
  versionStatus='Enabled',lockMode='COMPLIANCE',enabled='Enabled',
  retentionDays=30,error=null
}={}){
  const calls=[];
  const client={
    calls,destroyed:false,
    async send(command){
      calls.push({name:command.constructor.name,bucket:command.input?.Bucket});
      if(error)throw Error('synthetic-private-provider-error: '+error);
      if(command instanceof GetBucketVersioningCommand)
        return {Status:versionStatus};
      if(command instanceof GetObjectLockConfigurationCommand)
        return {ObjectLockConfiguration:{
          ObjectLockEnabled:enabled,
          Rule:{DefaultRetention:{Mode:lockMode,Days:retentionDays}}
        }};
      throw Error('unsafe synthetic command');
    },
    destroy(){this.destroyed=true;}
  };
  return client;
}
test('only exact approved dedicated B2 metadata target passes before client construction',()=>{
  assert.equal(assertSafeEnvironment(base()).bucket,'demos-gdpr-erasure-ci-only');
  const unsafe=[
    {GDPR_B2_METADATA_PROBE:'true'},
    {GDPR_B2_READONLY_APPROVED_BUCKET:'a-different-bucket'},
    {GDPR_B2_READONLY_BUCKET:'demos-log-archive-eu',
      GDPR_B2_READONLY_APPROVED_BUCKET:'demos-log-archive-eu'},
    {GDPR_B2_READONLY_BUCKET:'demos-log-archive-eu',
      GDPR_B2_READONLY_APPROVED_BUCKET:'demos-log-archive-eu',
      B2_BUCKET_NAME:'another-bucket'},
    {GDPR_B2_READONLY_ENDPOINT:'http://s3.eu-central-003.backblazeb2.com/'},
    {GDPR_B2_READONLY_ENDPOINT:'https://s3.us-east-005.backblazeb2.com/'},
    {GDPR_B2_READONLY_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com.evil.invalid/'},
    {GDPR_B2_READONLY_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com/?x=1'},
    {GDPR_B2_READONLY_REGION:'us-east-005'},
    {GDPR_B2_READONLY_MIN_RETENTION_DAYS:'0'},
    {GDPR_B2_READONLY_MIN_RETENTION_DAYS:'3001'},
    {GDPR_B2_READONLY_MIN_RETENTION_DAYS:'not-a-number'},
    {DATABASE_URL:'postgres://production.invalid'},
    {SUPABASE_DB_URL:'postgres://staging.invalid'},
    {SUPABASE_SERVICE_ROLE_KEY:'secret'},
    {AXIOM_API_TOKEN:'secret'},
    {B2_S3_ACCESS_KEY_ID:'archive-reader'},
    {GDPR_LEDGER_B2_ACCESS_KEY_ID:'event-writer'},
    {GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'event-writer'},
    {GDPR_LEDGER_B2_ENABLED:'true'},
    {GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true'},
    {GDPR_ERASURE_OUTBOX_ENABLED:'true'},
    {AXIOM_ARCHIVE_ENABLED:'true'},
    {RENDER:'true'}
  ];
  for(const change of unsafe){
    assert.throws(()=>assertSafeEnvironment({...base(),...change}),{message:BAD});
  }
});
test('preflight fails before SDK constructor or network use',async()=>{
  let called=false;
  const output=await runReadOnlyBucketProbe({
    env:{...base(),DATABASE_URL:'postgres://not-a-provider'},
    makeClient:()=>{called=true;throw Error('never allowed');}
  });
  assert.equal(called,false);
  assert.equal(output.status,BAD);
  assert.equal(output.recoveryReady,false);
  assert.equal(output.bucketMetadataVerified,false);
});
test('only GetBucketVersioning and GetObjectLockConfiguration for the approved bucket',async()=>{
  const client=fake();
  const t=readOnlyTransport(client,base().GDPR_B2_READONLY_BUCKET);
  await t.send(new GetBucketVersioningCommand({
    Bucket:base().GDPR_B2_READONLY_BUCKET}));
  await t.send(new GetObjectLockConfigurationCommand({
    Bucket:base().GDPR_B2_READONLY_BUCKET}));
  for(const command of [
    new PutObjectCommand({Bucket:base().GDPR_B2_READONLY_BUCKET,Key:'x'}),
    new GetObjectCommand({Bucket:base().GDPR_B2_READONLY_BUCKET,Key:'x'}),
    new ListObjectVersionsCommand({Bucket:base().GDPR_B2_READONLY_BUCKET}),
    new GetBucketVersioningCommand({Bucket:'unapproved-bucket'})
  ]){
    await assert.rejects(Promise.resolve().then(()=>t.send(command)),
      /NO_GO_GDPR_B2/);
  }
  assert.equal(client.calls.length,2);
});
test('COMPLIANCE metadata passes but absolutely never qualifies restore or event completeness',async()=>{
  const client=fake();
  const output=await runReadOnlyBucketProbe({
    env:base(),makeClient:()=>client
  });
  assert.equal(output.status,'READONLY_BUCKET_METADATA_COMPLIANCE_NOT_RECOVERY');
  assert.equal(output.bucketMetadataVerified,true);
  assert.equal(output.complianceDefaultVerified,true);
  assert.equal(output.bucketVersioningEnabled,true);
  for(const key of ['recoveryReady','restoreTestVerified',
    'completeGdprJournalVerified','objectVersionsVerified',
    'liveProductionIsolationVerified'])assert.equal(output[key],false);
  assert.deepEqual(client.calls.map(x=>x.name),[
    'GetBucketVersioningCommand','GetObjectLockConfigurationCommand']);
  assert.equal(client.destroyed,true);
});
test('no-go for missing versioning, GOV mode, no lock, too few days and malformed retention',async()=>{
  for(const f of [
    {versionStatus:'Suspended'},
    {versionStatus:null},
    {lockMode:'GOVERNANCE'},
    {enabled:'Disabled'},
    {retentionDays:29},
    {retentionDays:0},
    {retentionDays:3650},
    {retentionDays:'30'},
    {retentionDays:null}
  ]){
    const client=fake(f);
    const report=await runReadOnlyBucketProbe({env:base(),makeClient:()=>client});
    assert.equal(report.status,CLOSED,JSON.stringify(f));
    assert.equal(report.recoveryReady,false);
    assert.equal(report.bucketMetadataVerified,false);
    assert.equal(client.destroyed,true);
  }
});
test('SDK failures do not emit error, bucket, key or secret details',async()=>{
  const client=fake({error:'top-secret-credentials-and-private-uri'});
  const report=await runReadOnlyBucketProbe({env:base(),makeClient:()=>client});
  const json=JSON.stringify(report);
  assert.equal(report.status,CLOSED);
  for(const secret of ['top-secret','synthetic-metadata-reader-id',
    'synthetic-metadata-reader-secret','demos-gdpr-erasure-ci-only']){
    assert.ok(!json.includes(secret));
  }
  assert.equal(client.destroyed,true);
});
test('isolated entrypoint never imports app, DB, B2 event journal or servers',()=>{
  const src=fs.readFileSync(path.join(__dirname,
    '../scripts/attest-gdpr-b2-bucket-readonly.js'),'utf8');
  for(const forbidden of [
    /require\([^)]*(?:\/app|\/server|\/config\/database|\/privacyErasureB2Journal)/,
    /new PutObjectCommand\s*\(/,
    /new GetObjectCommand\s*\(/,
    /new ListObjectVersionsCommand\s*\(/,
    /\.listen\s*\(/,
    /process\.exitCode\s*=\s*0\b/
  ]) assert.doesNotMatch(src,forbidden);
  assert.match(src,/process\.exitCode=2/);
  assert.match(src,/completeGdprJournalVerified:false/);
});

test('invalid total deadline is rejected before constructing any client',async()=>{
  for(const timeoutMs of [0,-1,NaN,Infinity,'20',1.3,MAX_PROBE_MS+1]){
    let constructed=false;
    const output=await runReadOnlyBucketProbe({
      env:base(),timeoutMs,
      makeClient:()=>{constructed=true;throw Error('NO_SDK_ALLOWED');}
    });
    assert.equal(constructed,false);
    assert.equal(output.status,BAD);
    assert.equal(output.recoveryReady,false);
  }
});

test('read-only transport accepts only abortSignal and exact Bucket-only input',async()=>{
  const client=fake(),reader=readOnlyTransport(client,base().GDPR_B2_READONLY_BUCKET);
  const command=new GetBucketVersioningCommand({Bucket:base().GDPR_B2_READONLY_BUCKET});
  const signal=new AbortController().signal;
  await reader.send(command,{abortSignal:signal});
  for(const [invalid,options] of [
    [command,{}],[command,{abortSignal:'fake'}],
    [command,{abortSignal:signal,requestTimeout:0}],
    [new GetBucketVersioningCommand({Bucket:base().GDPR_B2_READONLY_BUCKET,ExpectedBucketOwner:'bad'}),undefined]
  ]){
    await assert.rejects(Promise.resolve().then(()=>reader.send(invalid,options)),
      /NO_GO_GDPR_B2/);
  }
  assert.equal(client.calls.length,1);
});

test('a stalled first metadata request times out, aborts and never reaches second read',async()=>{
  const calls=[],signals=[];
  const client={
    send(command,options){
      calls.push(command.constructor.name);
      signals.push(options.abortSignal);
      return new Promise(()=>{});
    },
    destroy(){this.destroyed=true;}
  };
  const result=await runReadOnlyBucketProbe({
    env:base(),timeoutMs:25,makeClient:()=>client
  });
  assert.equal(result.status,CLOSED);
  assert.equal(result.recoveryReady,false);
  assert.deepEqual(calls,['GetBucketVersioningCommand']);
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(signals[0].aborted,true);
  assert.equal(client.destroyed,true);
});

test('second metadata read is bounded by the same total deadline',async()=>{
  const calls=[],signals=[];
  const client={
    send(command,options){
      calls.push(command.constructor.name);
      signals.push(options.abortSignal);
      if(command instanceof GetBucketVersioningCommand)
        return Promise.resolve({Status:'Enabled'});
      return new Promise(()=>{});
    },
    destroy(){this.destroyed=true;}
  };
  const result=await runReadOnlyBucketProbe({
    env:base(),timeoutMs:25,makeClient:()=>client
  });
  assert.equal(result.status,CLOSED);
  assert.equal(result.bucketMetadataVerified,false);
  assert.deepEqual(calls,[
    'GetBucketVersioningCommand','GetObjectLockConfigurationCommand'
  ]);
  assert.equal(signals.length,2);
  assert.equal(signals[0],signals[1]);
  assert.equal(signals[1].aborted,true);
  assert.equal(client.destroyed,true);
});

test('late resolution after deadline cannot request Object Lock or publish success',async()=>{
  let resolveFirst;
  const calls=[];
  const client={
    send(command){
      calls.push(command.constructor.name);
      if(command instanceof GetBucketVersioningCommand){
        return new Promise(resolve=>{resolveFirst=resolve;});
      }
      throw Error('LATE_SECOND_READ_NOT_ALLOWED');
    },
    destroy(){this.destroyed=true;}
  };
  const result=await runReadOnlyBucketProbe({
    env:base(),timeoutMs:25,makeClient:()=>client
  });
  assert.equal(result.status,CLOSED);
  resolveFirst({Status:'Enabled'});
  await Promise.resolve();
  assert.deepEqual(calls,['GetBucketVersioningCommand']);
  assert.equal(client.destroyed,true);
});

test('provider cleanup failures cannot leak private errors or turn denial into success',async()=>{
  const client={
    async send(command){
      if(command instanceof GetBucketVersioningCommand) return {Status:'Enabled'};
      throw Error('sensitive-private-bucket-error');
    },
    destroy(){throw Error('sensitive-cleanup-error');}
  };
  const output=await runReadOnlyBucketProbe({
    env:base(),makeClient:()=>client
  });
  assert.equal(output.status,CLOSED);
  assert.equal(output.recoveryReady,false);
  assert.doesNotMatch(JSON.stringify(output),/sensitive|private-bucket|cleanup-error/);
});

test('successful two-request probe forwards AbortSignal and still cannot grant recovery',async()=>{
  const calls=[];
  const client=fake();
  const original=client.send.bind(client);
  client.send=(command,options)=>{
    calls.push({name:command.constructor.name,signal:options?.abortSignal});
    return original(command);
  };
  const result=await runReadOnlyBucketProbe({env:base(),
    timeoutMs:1000,makeClient:()=>client});
  assert.equal(result.bucketMetadataVerified,true);
  assert.equal(result.recoveryReady,false);
  assert.deepEqual(calls.map(x=>x.name),
    ['GetBucketVersioningCommand','GetObjectLockConfigurationCommand']);
  assert.equal(calls[0].signal,calls[1].signal);
  assert.equal(calls[0].signal.aborted,true);
});
