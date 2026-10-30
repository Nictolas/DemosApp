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
  runReadOnlyBucketProbe
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
    {versionStatus:undefined},
    {lockMode:'GOVERNANCE'},
    {enabled:'Disabled'},
    {retentionDays:29},
    {retentionDays:0},
    {retentionDays:3650},
    {retentionDays:'30'},
    {retentionDays:undefined}
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
