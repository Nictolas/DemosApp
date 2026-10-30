'use strict';
// Isolated test of the real DRAFT exporter with an injected, synthetic S3
// client. Never use a live Backblaze bucket, credentials, database or network.
const test=require('node:test');
const assert=require('node:assert/strict');
const {PrivacyErasureB2Journal}=
  require('../services/privacyErasureB2Journal');

const BUCKET='demos-gdpr-synthetic-test-bucket';
const EVENT={
  event_key:'00000000-0000-4000-8000-000000000111',
  subject_user_id:'00000000-0000-4000-8000-000000000112',
  event_type:'account_deleted',occurred_at:'2026-10-30T08:00:00.000Z',
  details:{synthetic:true}
};
const config=()=>({
  GDPR_LEDGER_B2_ENABLED:'true',
  GDPR_LEDGER_B2_BUCKET:BUCKET,
  GDPR_LEDGER_B2_REGION:'eu-central-003',
  GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
  GDPR_LEDGER_B2_ACCESS_KEY_ID:'synthetic-id',
  GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'synthetic-secret',
  GDPR_LEDGER_B2_RETENTION_DAYS:'30',
  B2_BUCKET_NAME:'unrelated-synthetic-log-bucket'
});
const compliance=(mode='COMPLIANCE',days=30)=>({
  ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
    Rule:{DefaultRetention:{Mode:mode,Days:days}}}
});
function make(client,ms=15) {
  return new PrivacyErasureB2Journal({
    env:config(),client,readbackTimeoutMs:ms,
    clock:()=>new Date('2026-10-30T09:00:00.000Z')
  });
}
function assertOnlyBucketRead(calls) {
  assert.deepEqual(calls.map(x=>x.command.constructor.name),
    ['GetObjectLockConfigurationCommand']);
  assert.deepEqual(calls[0].command.input,{Bucket:BUCKET});
  assert.deepEqual(Object.keys(calls[0].options),['abortSignal']);
  assert.ok(calls[0].options.abortSignal instanceof AbortSignal);
}

test('a permanently stalled bucket lock preflight has a bounded NO-GO deadline',async()=>{
  const calls=[];
  const client={send(command,options) {
    calls.push({command,options});
    return new Promise(()=>{});
  }};
  const journal=make(client);
  await assert.rejects(journal.verifyArchivedReceipt(EVENT,{
    versionId:'synthetic-version',sha256:'0'.repeat(64)
  }),/does not match/);
  // Use a matching event digest on the real verifier to reach B2 preflight.
  const {normalizeEvent}=require('../services/privacyErasureB2Journal');
  const crypto=require('node:crypto');
  const sha=crypto.createHash('sha256')
    .update(JSON.stringify(normalizeEvent(EVENT))).digest('hex');
  await assert.rejects(journal.verifyArchivedReceipt(EVENT,{
    versionId:'synthetic-version',sha256:sha
  }),{message:'GDPR_B2_BUCKET_COMPLIANCE_TIMEOUT'});
  assertOnlyBucketRead(calls);
  assert.equal(calls[0].options.abortSignal.aborted,true);
});

test('a delayed successful response cannot turn an expired check into acceptance',async()=>{
  const calls=[];
  let resolveSend;
  const client={send(command,options) {
    calls.push({command,options});
    return new Promise(resolve=>{resolveSend=resolve;});
  }};
  const journal=make(client);
  const pending=journal.assertBucketCompliance(client,journal.config());
  await assert.rejects(pending,{message:'GDPR_B2_BUCKET_COMPLIANCE_TIMEOUT'});
  resolveSend(compliance());
  await Promise.resolve();
  assertOnlyBucketRead(calls);
  assert.equal(calls[0].options.abortSignal.aborted,true);
});

test('successful bucket preflight checks the exact dedicated bucket and cleans abort',async()=>{
  const calls=[];
  const client={async send(command,options) {
    calls.push({command,options});
    return compliance();
  }};
  const journal=make(client);
  await journal.assertBucketCompliance(client,journal.config());
  assertOnlyBucketRead(calls);
  assert.equal(calls[0].options.abortSignal.aborted,true);
});

test('GOVERNANCE, inadequate days and missing lock all fail closed',async()=>{
  for(const result of [compliance('GOVERNANCE'),compliance('COMPLIANCE',1),
    {ObjectLockConfiguration:{ObjectLockEnabled:'Disabled'}},{},null]){
    const calls=[];
    const client={async send(command,options) {
      calls.push({command,options});
      return result;
    }};
    const journal=make(client);
    await assert.rejects(journal.assertBucketCompliance(client,journal.config()),
      /sufficient COMPLIANCE Object Lock/);
    assertOnlyBucketRead(calls);
  }
});

test('provider rejection propagates as NO-GO without any alternate B2 operation',async()=>{
  const calls=[];
  const client={async send(command,options){
    calls.push({command,options});
    throw Error('synthetic provider unavailable');
  }};
  const journal=make(client);
  await assert.rejects(journal.assertBucketCompliance(client,journal.config()),
    /synthetic provider unavailable/);
  assertOnlyBucketRead(calls);
  assert.equal(calls[0].options.abortSignal.aborted,true);
});

test('a stalled request cannot provoke PUT or a version read by the verifier',async()=>{
  const calls=[];
  const client={send(command,options) {
    calls.push({command,options});
    return new Promise(()=>{});
  }};
  const crypto=require('node:crypto');
  const {normalizeEvent}=require('../services/privacyErasureB2Journal');
  const hash=crypto.createHash('sha256')
    .update(JSON.stringify(normalizeEvent(EVENT))).digest('hex');
  await assert.rejects(make(client).verifyArchivedReceipt(EVENT,{
    versionId:'synthetic-version',sha256:hash
  }),{message:'GDPR_B2_BUCKET_COMPLIANCE_TIMEOUT'});
  assertOnlyBucketRead(calls);
});

test('invalid deadline configuration never creates an S3 client',()=>{
  for(const ms of [0,-1,15001,1.3,'5',NaN,null]) {
    assert.throws(()=>make({send(){throw Error('UNEXPECTED_NETWORK');}},ms),
      /Invalid bounded B2 readback timeout/);
  }
});
