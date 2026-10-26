'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrivacyErasureB2Journal, validatedConfig, keyFor } =
  require('../services/privacyErasureB2Journal');

const FIXED = new Date('2026-10-26T04:00:00.000Z');
const EVT = () => ({
  event_key:crypto.randomUUID(),
  subject_user_id:'00000000-0000-4000-8000-000000000311',
  event_type:'political_consent_revoked',
  occurred_at:'2026-10-26T03:00:00.000Z',
  details:{source:'synthetic',z:2}
});
function env(override={}) {
  return {
    GDPR_LEDGER_B2_ENABLED:'true',
    GDPR_LEDGER_B2_BUCKET:'demos-gdpr-erasure-test',
    GDPR_LEDGER_B2_REGION:'eu-central-003',
    GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
    GDPR_LEDGER_B2_ACCESS_KEY_ID:'test-id',
    GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'synthetic-secret',
    GDPR_LEDGER_B2_RETENTION_DAYS:'30',
    B2_BUCKET_NAME:'demos-log-archive-test',
    ...override
  };
}
class FakeB2 {
  constructor({mode='COMPLIANCE',days=30,failRead=false,failRetention=false}={}) {
    this.mode=mode;this.days=days;this.failRead=failRead;
    this.failRetention=failRetention;this.objects=new Map();this.calls=[];
    this.declaredLength=null;this.streamChunks=null;this.streamDestroyed=false;
  }
  async send(command) {
    const name=command.constructor.name,input=command.input;
    this.calls.push({name,input});
    if(name==='GetObjectLockConfigurationCommand') {
      return {ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
        Rule:{DefaultRetention:{Mode:this.mode,Days:this.days}}}};
    }
    const object=this.objects.get(input.Key);
    if(name==='HeadObjectCommand') {
      if(!object) throw Object.assign(Error('not found'),{name:'NoSuchKey'});
      return {ContentLength:object.body.length,Metadata:object.metadata,
        VersionId:object.versionId};
    }
    if(name==='PutObjectCommand') {
      if(this.objects.has(input.Key)) throw Error('Unexpected overwrite');
      const versionId='b2-version-'+(this.objects.size+1);
      this.objects.set(input.Key,{
        body:Buffer.from(input.Body),metadata:input.Metadata,
        versionId,until:input.ObjectLockRetainUntilDate,mode:input.ObjectLockMode
      });
      return {VersionId:versionId};
    }
    if(!object) throw Error('Missing object');
    if(input.VersionId!==object.versionId) throw Error('Wrong version');
    if(name==='GetObjectRetentionCommand') {
      return {Retention:{
        Mode:this.failRetention?'GOVERNANCE':object.mode,
        RetainUntilDate:object.until
      }};
    }
    if(name==='GetObjectCommand') {
      if(this.streamChunks) {
        const chunks=this.streamChunks;
        const stream={
          async *[Symbol.asyncIterator]() {
            for(const chunk of chunks) yield chunk;
          },
          destroy:()=>{this.streamDestroyed=true;}
        };
        return {ContentLength:this.declaredLength ?? undefined,Body:stream};
      }
      const payload=this.failRead?Buffer.from('{"bad":true}'):object.body;
      return {
        ContentLength:this.declaredLength ?? object.body.length,
        Body:{async *[Symbol.asyncIterator](){yield payload;}}
      };
    }
    throw Error('Unexpected AWS operation: '+name);
  }
}
function service(client,options={}) {
  return new PrivacyErasureB2Journal({
    client,env:env(options),clock:()=>new Date(FIXED)
  });
}
test('default disabled, log bucket reuse, unapproved retention and non-TLS endpoint all fail before network', async()=>{
  const fake=new FakeB2();
  for(const config of [
    env({GDPR_LEDGER_B2_ENABLED:'false'}),
    env({GDPR_LEDGER_B2_RETENTION_DAYS:''}),
    env({GDPR_LEDGER_B2_BUCKET:'demos-log-archive-test'}),
    env({GDPR_LEDGER_B2_ENDPOINT:'http://s3.eu-central-003.backblazeb2.com'}),
    env({GDPR_LEDGER_B2_ENDPOINT:'https://localhost:443'})
  ]) {
    const archive=new PrivacyErasureB2Journal({env:config,client:fake});
    await assert.rejects(archive.archiveEvent(EVT()),/disabled|dedicated|TLS/i);
  }
  assert.equal(fake.calls.length,0);
});
test('B2 COMPLIANCE bucket is required; GOVERNANCE or inadequate default days fail before PUT', async()=>{
  for(const config of [{mode:'GOVERNANCE',days:30},{mode:'COMPLIANCE',days:3}]){
    const b2=new FakeB2(config);
    await assert.rejects(service(b2).archiveEvent(EVT()),/COMPLIANCE/);
    assert.ok(!b2.calls.some(x=>x.name==='PutObjectCommand'));
  }
});
test('event writes only to dedicated bucket, no identity in keys or metadata; locked B2 version is read back',async()=>{
  const b2=new FakeB2();const event=EVT();
  const r=await service(b2).archiveEvent(event);
  assert.equal(r.reused,false);
  assert.equal(b2.objects.size,1);
  assert.ok(r.key.endsWith('/'+event.event_key+'.json'));
  assert.ok(!r.key.includes(event.subject_user_id));
  const put=b2.calls.find(x=>x.name==='PutObjectCommand').input;
  assert.equal(put.Bucket,'demos-gdpr-erasure-test');
  assert.equal(put.ObjectLockMode,'COMPLIANCE');
  assert.equal(put.ServerSideEncryption,'AES256');
  assert.equal(put.ContentType,'application/json');
  assert.deepEqual(Object.keys(put.Metadata),['sha256']);
  assert.equal(r.versionId,'b2-version-1');
  assert.equal(b2.calls.some(x=>x.name==='GetObjectRetentionCommand'),true);
  assert.equal(b2.calls.some(x=>x.name==='GetObjectCommand'),true);
  assert.equal(keyFor(event),r.key);
  const reused=await service(b2).archiveEvent({...event,details:{z:2,source:'synthetic'}});
  assert.equal(reused.reused,true);
  assert.equal(b2.calls.filter(x=>x.name==='PutObjectCommand').length,1);
});
test('read-only recovery verification refuses missing or altered immutable B2 versions',async()=>{
  const b2=new FakeB2(),event=EVT(),client=service(b2);
  const uploaded=await client.archiveEvent(event);
  const receipt={versionId:uploaded.versionId,sha256:uploaded.sha256};
  const putBefore=b2.calls.filter(c=>c.name==='PutObjectCommand').length;
  const checked=await client.verifyArchivedReceipt(event,receipt);
  assert.equal(checked.versionId,uploaded.versionId);
  assert.equal(b2.calls.filter(c=>c.name==='PutObjectCommand').length,putBefore);
  await assert.rejects(client.verifyArchivedReceipt(event,{
    versionId:uploaded.versionId,sha256:'f'.repeat(64)
  }),/does not match/);
  const original=b2.objects.get(uploaded.key);
  b2.objects.delete(uploaded.key);
  await assert.rejects(client.verifyArchivedReceipt(event,receipt),/Missing object/);
  assert.equal(b2.calls.filter(c=>c.name==='PutObjectCommand').length,putBefore,
    'readiness must never silently reupload missing evidence');
  b2.objects.set(uploaded.key,{...original,body:Buffer.from('{"altered":true}')});
  await assert.rejects(client.verifyArchivedReceipt(event,receipt),/hash mismatch/);
  assert.equal(b2.calls.filter(c=>c.name==='PutObjectCommand').length,putBefore);
});
test('readback is bounded: reject huge declared length before buffering and abort oversized streamed body',async()=>{
  const b2=new FakeB2(),event=EVT(),journal=service(b2);
  const saved=await journal.archiveEvent(event);
  const receipt={versionId:saved.versionId,sha256:saved.sha256};
  const putCount=b2.calls.filter(x=>x.name==='PutObjectCommand').length;

  // Header alone must reject before consuming any body stream.
  b2.declaredLength=90000000;
  await assert.rejects(journal.verifyArchivedReceipt(event,receipt),/bounded read limit/);
  b2.declaredLength=null;

  // A lying/missing ContentLength must not bypass the streaming cap.
  b2.streamChunks=[Buffer.alloc(4096),Buffer.alloc(4097)];
  await assert.rejects(journal.verifyArchivedReceipt(event,receipt),/bounded read limit/);
  assert.equal(b2.streamDestroyed,true);

  // A valid chunked body must still verify the exact immutable version.
  const valid=b2.objects.get(saved.key).body;
  b2.streamChunks=[valid.subarray(0,10),valid.subarray(10)];
  b2.streamDestroyed=false;
  const verified=await journal.verifyArchivedReceipt(event,receipt);
  assert.equal(verified.versionId,saved.versionId);
  assert.equal(b2.streamDestroyed,false);
  assert.equal(b2.calls.filter(x=>x.name==='PutObjectCommand').length,putCount,
    'readiness must remain strictly read-only');
});

test('nonstreaming B2 body is rejected without invoking an unbounded buffer helper',async()=>{
  const b2=new FakeB2(),event=EVT(),journal=service(b2);
  const saved=await journal.archiveEvent(event);
  const originalSend=b2.send.bind(b2);
  let called=false;
  b2.send=async command=>{
    if(command.constructor.name==='GetObjectCommand') {
      return {Body:{transformToByteArray:async()=>{called=true;return Buffer.alloc(1000000);}}};
    }
    return originalSend(command);
  };
  await assert.rejects(journal.verifyArchivedReceipt(event,{
    versionId:saved.versionId,sha256:saved.sha256
  }),/bounded Node stream/);
  assert.equal(called,false,'unbounded transformToByteArray must never run');
});

test('invalid COMPLIANCE retention is rejected before any B2 body download',async()=>{
  const b2=new FakeB2(),event=EVT(),journal=service(b2);
  const saved=await journal.archiveEvent(event);
  b2.failRetention=true;
  const readsBefore=b2.calls.filter(x=>x.name==='GetObjectCommand').length;
  await assert.rejects(journal.verifyArchivedReceipt(event,{
    versionId:saved.versionId,sha256:saved.sha256
  }),/COMPLIANCE/);
  assert.equal(b2.calls.filter(x=>x.name==='GetObjectCommand').length,readsBefore);
});

test('existing event key with changed content is a fatal conflict',async()=>{
  const b2=new FakeB2(),event=EVT();
  await service(b2).archiveEvent(event);
  await assert.rejects(service(b2).archiveEvent({...event,event_type:'political_consent_granted'}),/different content/);
  assert.equal(b2.calls.filter(x=>x.name==='PutObjectCommand').length,1);
});
test('readback hash mismatch and governance retention fail closed',async()=>{
  for(const bad of [{failRead:true},{failRetention:true}]){
    const b2=new FakeB2(bad);
    await assert.rejects(service(b2).archiveEvent(EVT()),/hash mismatch|COMPLIANCE/);
  }
});
test('cursor advances only when every object in bounded batch is verified',async()=>{
  const b2=new FakeB2();const a=EVT(),c=EVT();c.occurred_at='2026-10-26T03:30:00.000Z';
  const queries=[];
  const db={async query(sql,params){
    queries.push({sql,params});return {rows:[a,c]};
  }};
  const result=await service(b2).archiveBatch(db,{limit:2});
  assert.equal(result.exported,2);
  assert.deepEqual(result.cursor,{occurred_at:c.occurred_at,event_key:c.event_key});
  assert.equal(b2.objects.size,2);
  assert.ok(queries[0].sql.includes('ORDER BY occurred_at ASC,event_key ASC LIMIT $3'));
  assert.equal(queries[0].params[2],2);
  const disabled=new PrivacyErasureB2Journal({client:b2,env:env({GDPR_LEDGER_B2_ENABLED:'false'})});
  await assert.rejects(disabled.archiveBatch(db),/disabled/);
  assert.equal(queries.length,1);
});
test('invalid batch size and invalid UUID or oversized details reject before PUT',async()=>{
  const b2=new FakeB2(),s=service(b2),event=EVT();
  await assert.rejects(s.archiveBatch({query:async()=>({rows:[]})},{limit:999}),/bounded/);
  await assert.rejects(s.archiveEvent({...event,event_key:'no'}),/Invalid GDPR/);
  await assert.rejects(s.archiveEvent({...event,details:{info:'X'.repeat(9000)}}),/minimization limit/);
  assert.equal(b2.calls.some(x=>x.name==='PutObjectCommand'),false);
});
