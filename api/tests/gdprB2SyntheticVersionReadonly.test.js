'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {Readable} = require('node:stream');
const {
  GetObjectRetentionCommand, GetObjectCommand, PutObjectCommand,
  ListObjectVersionsCommand
} = require('@aws-sdk/client-s3');
const {
  MARKER, OBJECT_KEY, BAD, CLOSED, safeConfig, readOnlyTransport,
  MAX_PROBE_MS, verifySyntheticVersion
} = require('../scripts/attest-gdpr-b2-synthetic-version-readonly');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/gdpr-b2-synthetic-object-v1.json'));
const clock = () => new Date('2026-10-30T12:00:00.000Z');
const base = () => ({
  GDPR_B2_SYNTHETIC_VERSION_PROBE: MARKER,
  GDPR_B2_READONLY_BUCKET: 'demos-gdpr-erasure-synthetic-ci',
  GDPR_B2_READONLY_APPROVED_BUCKET: 'demos-gdpr-erasure-synthetic-ci',
  GDPR_B2_READONLY_REGION: 'eu-central-003',
  GDPR_B2_READONLY_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com',
  GDPR_B2_READONLY_ACCESS_KEY_ID: 'synthetic-only-reader-id',
  GDPR_B2_READONLY_SECRET_ACCESS_KEY: 'synthetic-only-reader-secret',
  GDPR_B2_READONLY_MIN_RETENTION_DAYS: '30',
  GDPR_B2_READONLY_MIN_REMAINING_DAYS: '2',
  GDPR_B2_READONLY_PROBE_VERSION_ID: '4_z_synthetic-version-123',
  B2_BUCKET_NAME: 'demos-log-archive-eu'
});
function fake({mode = 'COMPLIANCE', until = '2026-11-15T12:00:00Z',
  payload = fixture, contentLength = payload.length, error = null,
  versionId = '4_z_synthetic-version-123', omitVersionId = false,
  deleteMarker = false,
  objectLockMode = undefined, objectLockUntil = undefined} = {}) {
  const calls = [];
  const client = {
    calls, destroyed: false,
    async send(cmd) {
      calls.push({name:cmd.constructor.name, ...cmd.input});
      if(error) throw Error('SDK included private info: ' + error);
      if(cmd instanceof GetObjectRetentionCommand) {
        return {Retention:{Mode:mode,RetainUntilDate:until}};
      }
      if(cmd instanceof GetObjectCommand) {
        return {ContentLength:contentLength,
          ...(omitVersionId ? {} : {VersionId:versionId}),
          DeleteMarker:deleteMarker,ObjectLockMode:objectLockMode,
          ObjectLockRetainUntilDate:objectLockUntil,
          Body:Readable.from([payload])};
      }
      throw Error('not allowed');
    },
    destroy() { this.destroyed = true; }
  };
  return client;
}
test('rejects missing marker, wrong bucket, production env, invalid version and retention before network', async () => {
  const cases = [
    {GDPR_B2_SYNTHETIC_VERSION_PROBE:'true'},
    {GDPR_B2_METADATA_PROBE:'demos-gdpr-b2-isolated-metadata-readonly-v1'},
    {GDPR_B2_READONLY_PROBE_VERSION_ID:''},
    {GDPR_B2_READONLY_PROBE_VERSION_ID:'a version with spaces'},
    {GDPR_B2_READONLY_PROBE_VERSION_ID:'../this-is-not-a-version'},
    {GDPR_B2_READONLY_APPROVED_BUCKET:'other-bucket'},
    {GDPR_B2_READONLY_BUCKET:'demos-log-archive-eu',
      GDPR_B2_READONLY_APPROVED_BUCKET:'demos-log-archive-eu'},
    {GDPR_B2_READONLY_MIN_REMAINING_DAYS:'0'},
    {GDPR_B2_READONLY_MIN_REMAINING_DAYS:'3001'},
    {GDPR_B2_READONLY_ENDPOINT:'https://s3.another-region.backblazeb2.com'},
    {DATABASE_URL:'secret'},
    {GDPR_LEDGER_B2_ACCESS_KEY_ID:'writer'},
    {GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true'},
    {AXIOM_API_TOKEN:'private'},
    {RENDER:'true'}
  ];
  for(const patch of cases) {
    assert.throws(() => safeConfig({...base(),...patch}),{message:BAD});
    let wasConstructed=false;
    const result = await verifySyntheticVersion({env:{...base(),...patch},clock,
      makeClient:()=>{wasConstructed=true;return fake();}});
    assert.equal(wasConstructed,false, JSON.stringify(patch));
    assert.equal(result.status,BAD);
    assert.equal(result.recoveryReady,false);
  }
});
test('transport accepts only two read commands on fixed synthetic key/version/bucket',async()=>{
  const cfg = safeConfig(base());
  const client = fake();
  const gate = readOnlyTransport(client,cfg);
  await gate.send(new GetObjectRetentionCommand({Bucket:cfg.bucket,Key:OBJECT_KEY,VersionId:cfg.versionId}));
  await gate.send(new GetObjectCommand({Bucket:cfg.bucket,Key:OBJECT_KEY,VersionId:cfg.versionId}));
  for (const cmd of [
    new PutObjectCommand({Bucket:cfg.bucket,Key:OBJECT_KEY}),
    new ListObjectVersionsCommand({Bucket:cfg.bucket}),
    new GetObjectCommand({Bucket:cfg.bucket,Key:'demos/gdpr-erasure/v1/events/someone.json',VersionId:cfg.versionId}),
    new GetObjectCommand({Bucket:'other',Key:OBJECT_KEY,VersionId:cfg.versionId}),
    new GetObjectCommand({Bucket:cfg.bucket,Key:OBJECT_KEY,VersionId:'other-version'}),
    new GetObjectCommand({Bucket:cfg.bucket,Key:OBJECT_KEY,
      VersionId:cfg.versionId,Range:'bytes=0-20'}),
    new GetObjectRetentionCommand({Bucket:cfg.bucket,Key:OBJECT_KEY,
      VersionId:cfg.versionId,RequestPayer:'requester'})
  ]) await assert.rejects(Promise.resolve().then(()=>gate.send(cmd)),/NO_GO_GDPR_B2/);
  assert.equal(client.calls.length,2);
});
test('exact synthetic version + COMPLIANCE + correct bytes verified; never recovery-ready',async()=>{
  const client=fake();
  const result=await verifySyntheticVersion({env:base(),clock,makeClient:()=>client});
  assert.equal(result.status,'READONLY_SYNTHETIC_VERSION_VERIFIED_NOT_RECOVERY');
  assert.equal(result.syntheticVersionVerified,true);
  assert.equal(result.versionRetentionComplianceVerified,true);
  assert.equal(result.fixtureSha256Verified,true);
  for(const prop of ['recoveryReady','completeGdprJournalVerified',
      'actualGdprEventVersionsVerified','restoreTestVerified','externalCheckpointVerified']) {
    assert.equal(result[prop],false);
  }
  assert.deepEqual(client.calls.map(c=>c.name),[
    'GetObjectRetentionCommand','GetObjectCommand']);
  assert.ok(client.calls.every(c=>c.Key===OBJECT_KEY &&
    c.VersionId===base().GDPR_B2_READONLY_PROBE_VERSION_ID &&
    c.Bucket===base().GDPR_B2_READONLY_BUCKET));
  assert.equal(client.destroyed,true);
});
test('fails closed on GOVERNANCE, expired, insufficient or malformed retention before downloading',async()=>{
  for(const scenario of [
    {mode:'GOVERNANCE'},
    {mode:'none'},
    {until:'2026-10-29T12:00:00Z'},
    {until:'2026-10-31T12:00:00Z'},
    {until:'not-a-date'}
  ]) {
    const client=fake(scenario);
    const result=await verifySyntheticVersion({env:base(),clock,makeClient:()=>client});
    assert.equal(result.status,CLOSED);
    assert.equal(result.recoveryReady,false);
    assert.equal(client.calls.length,1);
    assert.equal(client.destroyed,true);
  }
});
test('fails closed on altered bytes, oversized object, invalid length or provider exception',async()=>{
  for(const scenario of [
    {payload:Buffer.from('{}')},
    {payload:Buffer.alloc(1025),contentLength:null},
    {contentLength:1025},
    {contentLength:-1},
    {error:'private-id-and-secret'}
  ]) {
    const client=fake(scenario);
    const result=await verifySyntheticVersion({env:base(),clock,makeClient:()=>client});
    assert.equal(result.status,CLOSED);
    assert.equal(result.syntheticVersionVerified,false);
    assert.equal(client.destroyed,true);
    const json=JSON.stringify(result);
    for(const forbidden of ['private-id','synthetic-only-reader-secret',
      'demos-gdpr-erasure-synthetic-ci','4_z_synthetic-version-123']) {
      assert.equal(json.includes(forbidden),false);
    }
  }
});


test('rejects wrong or absent version identity even when fixture bytes are exact',async()=>{
  for(const scenario of [{omitVersionId:true},{versionId:null},
    {versionId:'other-version'},{versionId:''}]) {
    const client=fake(scenario);
    const output=await verifySyntheticVersion({env:base(),clock,makeClient:()=>client});
    assert.equal(output.status,CLOSED,JSON.stringify(scenario));
    assert.equal(output.syntheticVersionVerified,false);
    assert.equal(output.recoveryReady,false);
    assert.deepEqual(client.calls.map(x=>x.name),[
      'GetObjectRetentionCommand','GetObjectCommand']);
    assert.equal(client.destroyed,true);
  }
});

test('rejects contradictory version retention, delete marker and response length',async()=>{
  const cases=[
    {deleteMarker:true},
    {objectLockMode:'GOVERNANCE'},
    {objectLockMode:'OFF'},
    {objectLockUntil:'2026-11-16T12:00:00Z'},
    {objectLockUntil:'not-a-date'},
    {contentLength:fixture.length-1},
    {contentLength:0},
    {contentLength:null,objectLockMode:'GOVERNANCE'}
  ];
  for(const scenario of cases){
    const client=fake(scenario);
    const output=await verifySyntheticVersion({env:base(),clock,makeClient:()=>client});
    assert.equal(output.status,CLOSED,JSON.stringify(scenario));
    assert.equal(output.syntheticVersionVerified,false);
    assert.equal(output.recoveryReady,false);
    assert.equal(client.destroyed,true);
  }
});

test('matching optional lock metadata is allowed, but still not recovery proof',async()=>{
  const client=fake({
    objectLockMode:'COMPLIANCE',objectLockUntil:'2026-11-15T12:00:00Z'
  });
  const output=await verifySyntheticVersion({env:base(),clock,makeClient:()=>client});
  assert.equal(output.syntheticVersionVerified,true);
  assert.equal(output.versionRetentionComplianceVerified,true);
  assert.equal(output.recoveryReady,false);
  assert.equal(output.completeGdprJournalVerified,false);
});


test('bounded preflight rejects invalid timeout before constructing an SDK client',async()=>{
  for (const timeoutMs of [0,-1,MAX_PROBE_MS+1,NaN,'25',Infinity]) {
    let constructed=false;
    const output=await verifySyntheticVersion({
      env:base(),clock,timeoutMs,
      makeClient:()=>{constructed=true;return fake();}
    });
    assert.equal(constructed,false);
    assert.equal(output.status,BAD);
    assert.equal(output.recoveryReady,false);
  }
});

test('read-only transport accepts only an AbortSignal option, never extra SDK controls',async()=>{
  const cfg=safeConfig(base());
  const client=fake();
  const reader=readOnlyTransport(client,cfg);
  const cmd=new GetObjectRetentionCommand({
    Bucket:cfg.bucket,Key:OBJECT_KEY,VersionId:cfg.versionId
  });
  const signal=new AbortController().signal;
  await reader.send(cmd,{abortSignal:signal});
  for(const options of [
    {abortSignal:signal,requestTimeout:0},
    {abortSignal:'not-a-signal'},
    {requestTimeout:0},
    {abortSignal:null},
    {}
  ]) {
    await assert.rejects(Promise.resolve().then(()=>reader.send(cmd,options)),
      /NO_GO_GDPR_B2_SYNTHETIC_OPERATION_REJECTED/);
  }
  assert.equal(client.calls.length,1);
});

test('stalled retention and stalled version fetch both time out NO-GO and abort SDK reads',async()=>{
  for(const stallAt of ['retention','version']){
    const normal=fake();
    const original=normal.send.bind(normal);
    let aborted=false;
    normal.send=(command,options)=>{
      assert.ok(options.abortSignal instanceof AbortSignal);
      if((stallAt==='retention' && command instanceof GetObjectRetentionCommand) ||
         (stallAt==='version' && command instanceof GetObjectCommand)) {
        return new Promise(()=>{options.abortSignal.addEventListener('abort',
          ()=>{aborted=true;},{once:true});});
      }
      return original(command);
    };
    const result=await verifySyntheticVersion({
      env:base(),clock,timeoutMs:30,makeClient:()=>normal
    });
    assert.equal(result.status,CLOSED,stallAt);
    assert.equal(result.syntheticVersionVerified,false);
    assert.equal(result.recoveryReady,false);
    assert.equal(aborted,true);
    assert.equal(normal.destroyed,true);
  }
});

test('stalled response body is destroyed on timeout without a positive attestation',async()=>{
  const stalled=new Readable({read(){}});
  const client=fake();
  const original=client.send.bind(client);
  client.send=async(command,options)=>{
    const response=await original(command,options);
    if(command instanceof GetObjectCommand) response.Body=stalled;
    return response;
  };
  const output=await verifySyntheticVersion({
    env:base(),clock,timeoutMs:30,makeClient:()=>client
  });
  assert.equal(output.status,CLOSED);
  assert.equal(output.syntheticVersionVerified,false);
  assert.equal(output.recoveryReady,false);
  assert.equal(stalled.destroyed,true);
  assert.equal(client.destroyed,true);
});

test('clock rollback between retention check and response fails closed',async()=>{
  let tick=0;
  const reversed=()=>{
    tick++;
    return new Date(tick===1
      ? '2026-10-30T12:00:00Z' : '2026-10-29T12:00:00Z');
  };
  const client=fake();
  const output=await verifySyntheticVersion({
    env:base(),clock:reversed,makeClient:()=>client
  });
  assert.equal(output.status,CLOSED);
  assert.equal(output.recoveryReady,false);
  assert.equal(output.syntheticVersionVerified,false);
  assert.equal(client.destroyed,true);
});


test('cleanup exceptions never leak SDK or body errors on deadline expiry',async()=>{
  let bodyDestroyCalled=false;
  let clientDestroyCalled=false;
  const neverEndingBody={
    async *[Symbol.asyncIterator]() { await new Promise(()=>{}); },
    destroy() {
      bodyDestroyCalled=true;
      throw Error('synthetic-sensitive-body-cleanup-error');
    }
  };
  const client=fake();
  const original=client.send.bind(client);
  client.send=async(command,options)=>{
    const response=await original(command,options);
    if(command instanceof GetObjectCommand) response.Body=neverEndingBody;
    return response;
  };
  client.destroy=()=>{
    clientDestroyCalled=true;
    throw Error('synthetic-sensitive-client-cleanup-error');
  };
  const output=await verifySyntheticVersion({
    env:base(),clock,timeoutMs:30,makeClient:()=>client
  });
  assert.equal(output.status,CLOSED);
  assert.equal(output.recoveryReady,false);
  assert.equal(bodyDestroyCalled,true);
  assert.equal(clientDestroyCalled,true);
  assert.doesNotMatch(JSON.stringify(output),/sensitive|cleanup-error/);
});
