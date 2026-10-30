'use strict';
// NO PROVIDER / NO DATABASE: inject a fake S3 client into the DRAFT exporter.
// No test has permission to call real AWS/B2, Render, or Supabase.
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const {GetObjectRetentionCommand,GetObjectCommand,
  GetObjectLockConfigurationCommand,PutObjectCommand}=
  require('@aws-sdk/client-s3');
const {PrivacyErasureB2Journal,normalizeEvent,keyFor}=
  require('../services/privacyErasureB2Journal');

const VERSION='synthetic-version-confirmed-v1';
const BUCKET='demos-gdpr-synthetic-only-bucket';
const NOW=new Date('2026-10-30T12:00:00.000Z');
const UNTIL=new Date('2026-12-15T12:00:00.000Z');
const raw={
  event_key:'00000000-0000-4000-8000-000000000321',
  subject_user_id:'00000000-0000-4000-8000-000000000322',
  event_type:'account_deleted',
  occurred_at:'2026-10-30T11:00:00.000000Z',
  details:{syntheticOnly:true}
};
const event=normalizeEvent(raw);
const body=Buffer.from(JSON.stringify(event));
const digest=crypto.createHash('sha256').update(body).digest('hex');
const env=()=>({
  GDPR_LEDGER_B2_ENABLED:'true',
  GDPR_LEDGER_B2_BUCKET:BUCKET,
  GDPR_LEDGER_B2_REGION:'eu-central-003',
  GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
  GDPR_LEDGER_B2_ACCESS_KEY_ID:'synthetic-read-only-key',
  GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'synthetic-test-secret',
  GDPR_LEDGER_B2_RETENTION_DAYS:'30',
  B2_BUCKET_NAME:'unrelated-axiom-log-archive'
});

function fixture({
  responseVersion=VERSION, contentLength=body.length,
  bytes=body, deleteMarker=false, lockMode='COMPLIANCE',
  readUntil=UNTIL, retentionUntil=UNTIL,
  omitVersion=false, omitLength=false, onRead=null
}={}) {
  const calls=[];
  let destroyed=0,reads=0;
  const fake={
    calls,
    async send(command) {
      calls.push({type:command.constructor.name,input:command.input});
      if(command instanceof GetObjectLockConfigurationCommand) {
        return {ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
          Rule:{DefaultRetention:{Mode:'COMPLIANCE',Days:30}}}};
      }
      if(command instanceof GetObjectRetentionCommand) {
        return {Retention:{Mode:'COMPLIANCE',RetainUntilDate:retentionUntil}};
      }
      if(command instanceof GetObjectCommand) {
        onRead?.();
        const stream=Readable.from([bytes]);
        const originalDestroy=stream.destroy.bind(stream);
        stream.destroy=(...args)=>{destroyed++;return originalDestroy(...args);};
        const originalIterator=stream[Symbol.asyncIterator].bind(stream);
        stream[Symbol.asyncIterator]=()=>{reads++;return originalIterator();};
        return {
          Body:stream,
          ...(omitVersion?{}:{VersionId:responseVersion}),
          ...(omitLength?{}:{ContentLength:contentLength}),
          DeleteMarker:deleteMarker,
          ObjectLockMode:lockMode,
          ObjectLockRetainUntilDate:readUntil
        };
      }
      if(command instanceof PutObjectCommand) throw Error('MUST_NEVER_WRITE');
      throw Error('UNEXPECTED_SYNTHETIC_COMMAND');
    }
  };
  const exporter=new PrivacyErasureB2Journal({env:env(),client:fake,
    clock:()=>new Date(NOW)});
  return {exporter,calls,counts:()=>({destroyed,reads})};
}

test('the draft readback validates exactly the requested version without any network',async()=>{
  const f=fixture();
  const result=await f.exporter.verifyArchivedReceipt(raw,{versionId:VERSION,sha256:digest});
  assert.equal(result.versionId,VERSION);
  assert.equal(result.sha256,digest);
  assert.equal(result.retentionUntil,UNTIL.toISOString());
  assert.deepEqual(f.calls.map(c=>c.type),[
    'GetObjectLockConfigurationCommand','GetObjectRetentionCommand',
    'GetObjectCommand']);
  const reads=f.calls.filter(c=>c.type==='GetObjectCommand');
  assert.deepEqual(reads.map(c=>c.input.VersionId),[VERSION]);
  assert.ok(f.calls.every(c=>c.input.Bucket===BUCKET));
});

test('version response must explicitly match receipt even with IDENTICAL bytes',async()=>{
  for(const v of ['synthetic-replaced-v2',null,'']) {
    const f=fixture({responseVersion:v});
    await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
      {versionId:VERSION,sha256:digest}),/version or metadata mismatch/);
    assert.equal(f.counts().reads,0,'do not consume untrusted body');
    assert.ok(f.counts().destroyed>=1);
  }
  const f=fixture({omitVersion:true});
  await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
    {versionId:VERSION,sha256:digest}),/version or metadata mismatch/);
  assert.equal(f.counts().reads,0);
});

test('delete marker or contradicting Object Lock headers fails before body read',async()=>{
  for(const scenario of [
    {deleteMarker:true},
    {lockMode:'GOVERNANCE'},
    {lockMode:'OFF'},
    {readUntil:new Date('2026-12-16T12:00:00Z')},
    {readUntil:'not-a-date'}
  ]) {
    const f=fixture(scenario);
    await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
      {versionId:VERSION,sha256:digest}),/version or metadata mismatch/);
    assert.equal(f.counts().reads,0);
  }
});

test('missing, invalid, oversized or false ContentLength fails closed',async()=>{
  for(const scenario of [
    {omitLength:true},{contentLength:null},{contentLength:-1},
    {contentLength:1.5},{contentLength:8193},{contentLength:'123'}
  ]) {
    const f=fixture(scenario);
    await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
      {versionId:VERSION,sha256:digest}),/version or metadata mismatch/);
    assert.equal(f.counts().reads,0);
  }
});

test('lying ContentLength fails AFTER bounded streaming even when hash matches',async()=>{
  const f=fixture({contentLength:body.length-1});
  await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
    {versionId:VERSION,sha256:digest}),/length mismatch/);
});

test('changed event bytes fail even with same version, ContentLength and lock',async()=>{
  const changed=Buffer.from(body);
  changed[changed.length-2]=changed[changed.length-2]===0x61?0x62:0x61;
  const f=fixture({bytes:changed});
  await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
    {versionId:VERSION,sha256:digest}),/hash mismatch/);
});

test('retention mode or expired lock is rejected before a GetObject',async()=>{
  const f=fixture({retentionUntil:new Date('2026-10-29T12:00:00Z')});
  await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
    {versionId:VERSION,sha256:digest}),/not retained/);
  assert.equal(f.calls.some(c=>c.type==='GetObjectCommand'),false);
});

test('forged local receipt hash must be rejected without touching B2',async()=>{
  const f=fixture();
  await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
    {versionId:VERSION,sha256:'f'.repeat(64)}),/does not match/);
  assert.equal(f.calls.length,0);
});

test('unexpected provider version readback never triggers a corrective upload',async()=>{
  const f=fixture({responseVersion:'another-version'});
  await assert.rejects(f.exporter.verifyArchivedReceipt(raw,
    {versionId:VERSION,sha256:digest}),/version or metadata mismatch/);
  assert.ok(f.calls.every(c=>c.type!=='PutObjectCommand'));
});

test('no real backend is required by read-only isolated test fixture',()=>{
  const f=fixture();
  assert.equal(f.exporter.config().bucket,BUCKET);
  assert.equal(keyFor(event).includes('/events/'),true);
  assert.equal(f.calls.length,0);
});
