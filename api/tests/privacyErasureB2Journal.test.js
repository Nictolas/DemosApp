'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrivacyErasureB2Journal, normalizeEvent, validatedConfig, keyFor } =
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
        return {VersionId:object.versionId,
          ContentLength:this.declaredLength ?? object.body.length,
          ObjectLockMode:object.mode,ObjectLockRetainUntilDate:object.until,
          DeleteMarker:false,Body:stream};
      }
      const payload=this.failRead?Buffer.from('{"bad":true}'):object.body;
      return {
        VersionId:object.versionId,
        ContentLength:this.declaredLength ?? object.body.length,
        ObjectLockMode:object.mode,ObjectLockRetainUntilDate:object.until,
        DeleteMarker:false,Body:{async *[Symbol.asyncIterator](){yield payload;}}
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
test('B2 config rejects region/endpoint mismatch before any network I/O',async()=>{
  const fake=new FakeB2();
  for(const override of [
    {GDPR_LEDGER_B2_REGION:'us-west-004'},
    {GDPR_LEDGER_B2_REGION:'EU-CENTRAL-003'},
    {GDPR_LEDGER_B2_REGION:'eu-central-003/other'},
    {GDPR_LEDGER_B2_ENDPOINT:'https://s3.us-west-004.backblazeb2.com'},
    {GDPR_LEDGER_B2_ENDPOINT:'https://user:pass@s3.eu-central-003.backblazeb2.com'},
    {GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com:444'}
  ]) {
    const cfg=env(override);
    assert.throws(()=>validatedConfig(cfg),/matching the configured region/);
    await assert.rejects(
      new PrivacyErasureB2Journal({env:cfg,client:fake}).archiveEvent(EVT()),
      /matching the configured region/
    );
    assert.equal(fake.calls.length,0,'archive must reject before network I/O');
  }
  const valid=validatedConfig(env());
  assert.equal(valid.region,'eu-central-003');
  assert.equal(valid.endpoint,'https://s3.eu-central-003.backblazeb2.com');
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
  assert.equal(checked.retentionUntil,b2.objects.get(uploaded.key).until.toISOString(),
    'readback must expose the independently verified COMPLIANCE expiry');
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
  await assert.rejects(journal.verifyArchivedReceipt(event,receipt),/version or metadata mismatch/);
  b2.declaredLength=null;

  // A lying but bounded ContentLength must not bypass the streaming cap.
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
      const stored=b2.objects.get(saved.key);
      return {VersionId:stored.versionId,ContentLength:stored.body.length,
        ObjectLockMode:stored.mode,ObjectLockRetainUntilDate:stored.until,
        DeleteMarker:false,
        Body:{transformToByteArray:async()=>{called=true;return Buffer.alloc(1000000);}}};
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

test('recovery rejects Object Lock that expires while its version body is read',async()=>{
  const b2=new FakeB2(),event=EVT();
  let now=new Date(FIXED);
  const journal=new PrivacyErasureB2Journal({
    client:b2,env:env(),clock:()=>new Date(now)
  });
  const saved=await journal.archiveEvent(event);
  // Synthetic near-expiry version: it is retained at the initial metadata
  // check, but no longer retained when the body download finishes.
  b2.objects.get(saved.key).until=new Date(FIXED.getTime()+1000);
  const send=b2.send.bind(b2);
  b2.send=async command=>{
    const response=await send(command);
    if(command.constructor.name==='GetObjectCommand') {
      now=new Date(FIXED.getTime()+2000);
    }
    return response;
  };
  const putBefore=b2.calls.filter(x=>x.name==='PutObjectCommand').length;
  await assert.rejects(journal.verifyArchivedReceipt(event,{
    versionId:saved.versionId,sha256:saved.sha256
  }),/retention expired during readback/);
  assert.equal(b2.calls.filter(x=>x.name==='PutObjectCommand').length,putBefore,
    'recovery must not repair expired evidence by writing a new version');
});

test('recovery rejects a version whose retention expires exactly at readback completion',async()=>{
  const b2=new FakeB2(),event=EVT();
  let now=new Date(FIXED);
  const journal=new PrivacyErasureB2Journal({
    client:b2,env:env(),clock:()=>new Date(now)
  });
  const saved=await journal.archiveEvent(event);
  const expires=new Date(FIXED.getTime()+1000);
  b2.objects.get(saved.key).until=expires;
  const send=b2.send.bind(b2);
  b2.send=async command=>{
    const response=await send(command);
    if(command.constructor.name==='GetObjectCommand') now=new Date(expires);
    return response;
  };
  const writesBefore=b2.calls.filter(x=>x.name==='PutObjectCommand').length;
  await assert.rejects(journal.verifyArchivedReceipt(event,{
    versionId:saved.versionId,sha256:saved.sha256
  }),/retention expired during readback/);
  assert.equal(b2.calls.filter(x=>x.name==='PutObjectCommand').length,writesBefore);
});

test('invalid verification clock fails before contacting B2',async()=>{
  const b2=new FakeB2(),event=EVT();
  const saved=await service(b2).archiveEvent(event);
  const invalid=new PrivacyErasureB2Journal({
    client:b2,env:env(),clock:()=>new Date(NaN)
  });
  const before=b2.calls.length;
  await assert.rejects(invalid.verifyArchivedReceipt(event,{
    versionId:saved.versionId,sha256:saved.sha256
  }),/Invalid clock/);
  assert.equal(b2.calls.length,before);
});

test('missing or null JSONB details fail closed before any B2 I/O',async()=>{
  const fake=new FakeB2();
  const journal=service(fake);
  const event=EVT();
  for(const malformed of [
    {...event,details:null},
    {...event,details:undefined},
    {...event,details:false},
    {...event,details:[]}
  ]) {
    assert.throws(()=>normalizeEvent(malformed),/Invalid GDPR ledger details/);
    await assert.rejects(journal.archiveEvent(malformed),/Invalid GDPR ledger details/);
  }
  assert.equal(fake.calls.length,0,'malformed events must not reach the B2 endpoint');
});

test('noncanonical mixed-case event IDs cannot produce B2 objects',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  const event={...EVT(),event_key:'ABCDEF12-3456-4ABC-8DEF-123456789ABC'};
  await assert.rejects(journal.archiveEvent(event),/Invalid GDPR ledger event/);
  assert.equal(b2.calls.length,0,'reject malformed event IDs before any remote request');
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
    await assert.rejects(service(b2).archiveEvent(EVT()),/length mismatch|hash mismatch|COMPLIANCE/);
  }
});
test('cursor advances only when every object in bounded batch is verified',async()=>{
  const b2=new FakeB2();const a=EVT(),c=EVT();c.occurred_at='2026-10-26T03:30:00.000Z';
  const queries=[];
  const db={async query(sql,params){
    queries.push({sql,params});return {rows:[
      {...a,complete_visibility:true,cursor_occurred_at:'2026-10-26T03:00:00.000000Z'},
      {...c,complete_visibility:true,cursor_occurred_at:'2026-10-26T03:30:00.000000Z'}
    ]};
  }};
  const result=await service(b2).archiveBatch(db,{limit:2});
  assert.equal(result.exported,2);
  assert.deepEqual(result.cursor,{
    occurred_at:'2026-10-26T03:30:00.000000Z',event_key:c.event_key
  });
  assert.ok(queries[0].sql.includes('AS cursor_occurred_at'));
  assert.equal(b2.objects.size,2);
  assert.ok(queries[0].sql.includes('ORDER BY occurred_at ASC,event_key ASC LIMIT $3'));
  assert.equal(queries[0].params[2],2);
  const disabled=new PrivacyErasureB2Journal({client:b2,env:env({GDPR_LEDGER_B2_ENABLED:'false'})});
  await assert.rejects(disabled.archiveBatch(db),/disabled/);
  assert.equal(queries.length,1);
});
test('manual archive refuses a filtered, unverifiable or empty SQL snapshot before B2',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  const valid={...EVT(),cursor_occurred_at:'2026-10-26T03:00:00.000000Z'};
  let sqlCount=0;
  for(const rows of [
    [{complete_visibility:false,event_key:null}],
    [{...valid,complete_visibility:false}],
    [],
    [{complete_visibility:null,event_key:null}]
  ]) {
    const db={async query(sql){
      sqlCount++;
      assert.match(sql,/WITH visibility AS MATERIALIZED/);
      assert.match(sql,/row_security_active/);
      assert.match(sql,/LEFT JOIN LATERAL/);
      return {rows};
    }};
    await assert.rejects(journal.archiveBatch(db,{limit:1}),
      /GDPR_B2_ARCHIVE_INCOMPLETE_VISIBILITY/);
  }
  assert.equal(sqlCount,4,'one verified page SQL statement per attempt');
  assert.equal(b2.calls.length,0,'never touch B2 after an incomplete SQL view');
});

test('manual B2 exporter cannot read a pg_temp ledger shadow',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  const official=EVT();
  const tempShadow={...EVT(),event_key:'ffffffff-ffff-4fff-8fff-ffffffffffff'};
  const db={async query(sql){
    // A borrowed PostgreSQL session could carry an earlier temporary relation
    // named privacy_erasure_ledger. An unqualified FROM would read it instead.
    if (sql.includes('FROM public.privacy_erasure_ledger ')) {
      return {rows:[{...official,complete_visibility:true,cursor_occurred_at:'2026-10-26T03:00:00.000000Z'}]};
    }
    return {rows:[{...tempShadow,complete_visibility:true,cursor_occurred_at:'2026-10-26T03:00:00.000000Z'}]};
  }};
  const result=await journal.archiveBatch(db,{limit:1});
  assert.equal(result.exported,1);
  assert.equal(result.cursor.event_key,official.event_key);
  assert.equal(b2.objects.size,1);
  assert.ok(b2.objects.has(keyFor(official)));
  assert.ok(!b2.objects.has(keyFor(tempShadow)));
});

test('manual B2 batch cursor preserves PostgreSQL microseconds across pages',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  // Opposite UUID lexical order deliberately rules out UUID ordering as a
  // substitute for the precise timestamp ordering used by PostgreSQL.
  const a={...EVT(),event_key:'ffffffff-ffff-4fff-8fff-ffffffffffff'};
  const b={...EVT(),event_key:'00000000-0000-4000-8000-000000000001'};
  // Node pg normally converts TIMESTAMPTZ to Date, losing microseconds.
  // Both event JSON bodies contain the same normalized millisecond.
  const first='2026-10-26T03:00:00.000123Z';
  const second='2026-10-26T03:00:00.000987Z';
  const queries=[];
  const db={async query(sql,params){
    queries.push(params);
    assert.ok(sql.includes('to_char(occurred_at AT TIME ZONE'));
    if(params[0]===null) return {rows:[{...a,complete_visibility:true,cursor_occurred_at:first}]};
    if(params[0]===first && params[1]===a.event_key) {
      return {rows:[{...b,complete_visibility:true,cursor_occurred_at:second}]};
    }
    if(params[0]===second && params[1]===b.event_key) return {rows:[{complete_visibility:true,event_key:null}]};
    throw Error('Repeated or truncated PostgreSQL timestamp cursor');
  }};
  const one=await journal.archiveBatch(db,{limit:1});
  assert.deepEqual(one.cursor,{occurred_at:first,event_key:a.event_key});
  const two=await journal.archiveBatch(db,{after:one.cursor,limit:1});
  assert.deepEqual(two.cursor,{occurred_at:second,event_key:b.event_key});
  const done=await journal.archiveBatch(db,{after:two.cursor,limit:1});
  assert.equal(done.exported,0);
  assert.deepEqual(done.cursor,two.cursor);
  assert.equal(b2.objects.size,2);
  assert.equal(queries.length,3);
});

test('manual B2 archive refuses missing exact timestamp before remote I/O',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  await assert.rejects(journal.archiveBatch({
    async query(){return {rows:[{...EVT(),complete_visibility:true}]};}
  },{limit:1}),/requires exact PostgreSQL timestamp cursor/);
  assert.equal(b2.calls.length,0);
  await assert.rejects(journal.archiveBatch({query:async()=>({rows:[{complete_visibility:true,event_key:null}]})},{
    after:{occurred_at:'2026-10-26T03:00:00.00012INVALIDZ',
      event_key:'ffffffff-ffff-4fff-8fff-ffffffffffff'},
    limit:1
  }),/Invalid archive cursor/);
});

test('manual B2 archive rejects lossy or invalid resume cursor before SQL and B2',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  let sql=0;
  const db={async query(){sql++;return {rows:[{complete_visibility:true,event_key:null}]};}};
  const key='ffffffff-ffff-4fff-8fff-ffffffffffff';
  const invalid=[
    {occurred_at:new Date('2026-10-26T03:00:00.000Z'),event_key:key},
    {occurred_at:'2026-10-26T03:00:00.000Z',event_key:key},
    {occurred_at:'2026-10-26T03:00:00.00012Z',event_key:key},
    {occurred_at:'2026-02-30T03:00:00.000123Z',event_key:key},
    {occurred_at:'2026-10-26T03:00:00.000123Z',event_key:key.toUpperCase()}
  ];
  for(const after of invalid) {
    await assert.rejects(journal.archiveBatch(db,{after,limit:1}),
      /Invalid archive cursor/);
  }
  assert.equal(sql,0,'invalid cursor must be refused before database query');
  assert.equal(b2.calls.length,0,'invalid cursor must not contact B2');
  const exact={occurred_at:'2026-10-26T03:00:00.000123Z',event_key:key};
  const result=await journal.archiveBatch(db,{after:exact,limit:1});
  assert.deepEqual(result.cursor,exact);
  assert.equal(result.exported,0);
  assert.equal(sql,1);
});

test('invalid batch size and invalid UUID or oversized details reject before PUT',async()=>{
  const b2=new FakeB2(),s=service(b2),event=EVT();
  await assert.rejects(s.archiveBatch({query:async()=>({rows:[{complete_visibility:true,event_key:null}]})},{limit:999}),/bounded/);
  await assert.rejects(s.archiveEvent({...event,event_key:'no'}),/Invalid GDPR/);
  await assert.rejects(s.archiveEvent({...event,details:{info:'X'.repeat(9000)}}),/minimization limit/);
  assert.equal(b2.calls.some(x=>x.name==='PutObjectCommand'),false);
});

test('immutable B2 content distinguishes adjacent PostgreSQL microseconds',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  const event={...EVT(),occurred_at:'2026-10-26T03:00:00.123456Z'};
  const next={...event,occurred_at:'2026-10-26T03:00:00.123457Z'};
  assert.notEqual(JSON.stringify(normalizeEvent(event)),JSON.stringify(normalizeEvent(next)));
  const archived=await journal.archiveEvent(event);
  assert.equal(JSON.parse(b2.objects.get(archived.key).body.toString()).occurred_at,event.occurred_at);
  await assert.rejects(journal.archiveEvent(next),/different content/);
  assert.equal(b2.calls.filter(c=>c.name==='PutObjectCommand').length,1);
});

test('archiveBatch writes exact SQL cursor instead of lossy pg Date',async()=>{
  const b2=new FakeB2(),journal=service(b2);
  const event=EVT(),exact='2026-10-26T03:00:00.123456Z';
  const db={async query(){return {rows:[{
    ...event,complete_visibility:true,occurred_at:new Date('2026-10-26T03:00:00.123Z'),
    cursor_occurred_at:exact
  }]};}};
  const result=await journal.archiveBatch(db,{limit:1});
  assert.equal(result.exported,1);
  assert.equal(result.cursor.occurred_at,exact);
  const stored=b2.objects.get(keyFor({...event,occurred_at:exact}));
  assert.ok(stored);
  assert.equal(JSON.parse(stored.body.toString()).occurred_at,exact);
});
