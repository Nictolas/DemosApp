'use strict';
// Fully synthetic B2 transport. No real network, secrets, SQL, or provider calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {Readable} = require('node:stream');
const {GetObjectRetentionCommand, GetObjectCommand} = require('@aws-sdk/client-s3');
const {PrivacyErasureB2Journal, normalizeEvent, keyFor} = require('../services/privacyErasureB2Journal');

const NOW = new Date('2026-10-30T12:00:00Z');
const UNTIL = new Date('2026-12-15T12:00:00Z');
const VERSION = 'synthetic-version-v1';
const raw = {event_key:'00000000-0000-4000-8000-000000000321',
  subject_user_id:'00000000-0000-4000-8000-000000000322',
  event_type:'account_deleted', occurred_at:'2026-10-30T11:00:00.000000Z',
  details:{syntheticOnly:true}};
const event = normalizeEvent(raw);
const bytes = Buffer.from(JSON.stringify(event));
const digest = crypto.createHash('sha256').update(bytes).digest('hex');
const env = {GDPR_LEDGER_B2_ENABLED:'true',
  GDPR_LEDGER_B2_BUCKET:'synthetic-gdpr-archive',
  GDPR_LEDGER_B2_REGION:'eu-central-003',
  GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
  GDPR_LEDGER_B2_ACCESS_KEY_ID:'fake', GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'fake',
  GDPR_LEDGER_B2_RETENTION_DAYS:'30', B2_BUCKET_NAME:'other-bucket'};
function make(send, timeout = 20) {
  const client = {send};
  const journal = new PrivacyErasureB2Journal({env, client,
    clock:()=>new Date(NOW), readbackTimeoutMs:timeout});
  return {client,journal, run:()=>journal.readVerified(client,journal.config(),
    keyFor(event),event,digest,VERSION,NOW)};
}
function retention() {return {Retention:{Mode:'COMPLIANCE',RetainUntilDate:UNTIL}};}
function object(body=Readable.from([bytes])) {
  return {Body:body,VersionId:VERSION,ContentLength:bytes.length,
    ObjectLockMode:'COMPLIANCE',ObjectLockRetainUntilDate:UNTIL};
}
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

test('retention request that ignores abort times out fail closed', async()=>{
  let signal;
  const f=make((cmd,options)=>{
    assert.ok(cmd instanceof GetObjectRetentionCommand);
    signal=options.abortSignal;
    return new Promise(()=>{});
  });
  await assert.rejects(f.run(),/GDPR_B2_READBACK_TIMEOUT/);
  assert.equal(signal.aborted,true);
});

test('GetObject request that ignores abort times out fail closed',async()=>{
  let signal, calls=0;
  const f=make((cmd,options)=>{
    calls++;
    if(cmd instanceof GetObjectRetentionCommand) return retention();
    assert.ok(cmd instanceof GetObjectCommand);
    signal=options.abortSignal;
    return new Promise(()=>{});
  });
  await assert.rejects(f.run(),/GDPR_B2_READBACK_TIMEOUT/);
  assert.equal(signal.aborted,true);
  assert.equal(calls,2);
});

test('unending GetObject stream is destroyed at deadline',async()=>{
  let destroyed=false;
  const stalled=new Readable({read(){}});
  const originalDestroy=stalled.destroy.bind(stalled);
  stalled.destroy=(...args)=>{destroyed=true;return originalDestroy(...args);};
  const f=make(async cmd=>cmd instanceof GetObjectRetentionCommand?
    retention():object(stalled));
  await assert.rejects(f.run(),/GDPR_B2_READBACK_TIMEOUT/);
  assert.equal(destroyed,true);
});

test('late retention response cannot trigger a GetObject after timeout',async()=>{
  let calls=0;
  const f=make(async cmd=>{
    calls++;
    assert.ok(cmd instanceof GetObjectRetentionCommand);
    await delay(65);
    return retention();
  });
  await assert.rejects(f.run(),/GDPR_B2_READBACK_TIMEOUT/);
  await delay(75);
  assert.equal(calls,1);
});

test('late object response is destroyed even when transport ignores abort',async()=>{
  let destroyed=false;
  const stream=Readable.from([bytes]);
  const originalDestroy=stream.destroy.bind(stream);
  stream.destroy=(...args)=>{destroyed=true;return originalDestroy(...args);};
  const f=make(async cmd=>{
    if(cmd instanceof GetObjectRetentionCommand)return retention();
    await delay(65);
    return object(stream);
  });
  await assert.rejects(f.run(),/GDPR_B2_READBACK_TIMEOUT/);
  await delay(75);
  assert.equal(destroyed,true);
});

test('normal version readback completes and supplies abort signals to both requests',async()=>{
  const signals=[];
  const f=make(async(cmd,options)=>{
    signals.push(options.abortSignal);
    return cmd instanceof GetObjectRetentionCommand?retention():object();
  },500);
  const result=await f.run();
  assert.equal(result.versionId,VERSION);
  assert.equal(result.sha256,digest);
  assert.equal(signals.length,2);
  assert.ok(signals.every(s=>s instanceof AbortSignal));
});

test('timeout cannot be disabled or made unbounded by constructor input',()=>{
  for(const invalid of [0,-1,15001,Infinity,NaN,'15000',1.5]){
    assert.throws(()=>new PrivacyErasureB2Journal({readbackTimeoutMs:invalid}),
      /Invalid bounded B2 readback timeout/);
  }
});
