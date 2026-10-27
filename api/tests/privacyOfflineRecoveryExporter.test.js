'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {PrivacyOfflineRecoveryExporter} = require('../services/privacyOfflineRecoveryExporter');
const {normalizeEvent: normalizeB2Event} = require('../services/privacyErasureB2Journal');
const {signature, manifestDigest} = require('../services/privacyRecoveryGateService');

const ID = 'offline_ci_20261026';
const SECRET = 'synthetic-only-offline-recovery-HMAC-key-32bytes';
const EVENT = {
  event_key:'00000000-0000-4000-8000-000000000326',
  subject_user_id:'00000000-0000-4000-8000-000000000001',
  event_type:'political_consent_revoked',
  occurred_at:'2026-10-26T00:10:00.000Z',
  details:{source:'synthetic',reason:'consent'}
};
const VALID_ENV = {
  DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'true',
  GDPR_ERASURE_OUTBOX_ENABLED:'true',
  GDPR_ERASURE_RECOVERY_OFFLINE_EXPORT_ENABLED:'true',
  GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'false'
};
const NOW = new Date('2026-10-26T01:00:00.000Z');
function fixture(events = [EVENT]) {
  const payload = {
    formatVersion:1,recoveryId:ID,
    capturedAt:'2026-10-26T00:30:00.000Z',
    restoredBackupTakenAt:'2026-10-25T00:00:00.000Z',
    events
  };
  const envelope={payload,signature:signature(payload,SECRET)};
  return {
    envelope, secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:payload.restoredBackupTakenAt,
    expectedCapturedAt:payload.capturedAt,
    maintenanceConfirmed:true,quarantineConfirmed:true,
    limit:1
  };
}
function receipt(event) {
  const sha256=crypto.createHash('sha256')
    .update(JSON.stringify(normalizeB2Event(event))).digest('hex');
  return {eventKey:event.event_key,sha256,
    versionId:'synthetic-immutable-version',
    retentionUntil:'2026-10-27T00:00:00.000Z'};
}
function fakeDb(events = [EVENT], {unapproved=false, missing=false, orphan=false,
  altered=false, deliveredEvents=[], tamperKey=null, onUpdate=null,
  onCommit=null, commitFault=null} = {}) {
  const calls=[];
  let committed=false, staged=false, firstCommit=true;
  const db={async query(sql,params=[]) {
    calls.push(sql);
    if (sql.startsWith('BEGIN TRANSACTION')) {staged=false;return {rows:[]};}
    if (sql === 'COMMIT') {
      const fault=firstCommit ? commitFault : null;
      firstCommit=false;
      if (fault === 'before') throw Error('synthetic commit rejected before durability');
      if (staged) committed=true;
      staged=false;
      if (onCommit) onCommit();
      if (fault === 'after') throw Error('synthetic commit acknowledgment lost');
      return {rows:[]};
    }
    if (sql === 'ROLLBACK') {staged=false;return {rows:[]};}
    if (sql === 'SET LOCAL search_path = pg_catalog, public, pg_temp') {
      return {rows:[]};
    }
    if (sql.startsWith('SELECT pg_advisory_xact_lock') ||
        sql.startsWith('LOCK TABLE privacy_erasure_ledger')) return {rows:[]};
    if (sql.includes("to_regclass('public.privacy_erasure_ledger')")) {
      return {rows:[{ledger:true,outbox:true}]};
    }
    if (sql.includes('FROM privacy_erasure_ledger ') &&
        sql.includes('WHERE event_key > $1 ORDER BY event_key ASC LIMIT $2')) {
      const extra={...EVENT,event_key:'ffffffff-ffff-4fff-8fff-ffffffffffff'};
      const source=[...events,...deliveredEvents,...(unapproved?[extra]:[])].sort(
        (a,b)=>a.event_key.localeCompare(b.event_key));
      const visible=(missing?source.slice(1):source)
        .filter(e=>e.event_key>params[0]).slice(0,params[1]);
      return {rows:visible.map(e=>(altered ||
        e.event_key===tamperKey)
        ? {...e,details:{source:'tampered-delivered-or-pending'}} : e)};
    }
    if (sql.includes('LEFT JOIN privacy_erasure_delivery_outbox o') &&
        sql.includes('UNION ALL')) {
      return {rows:[{present:orphan}]};
    }
    if (sql.includes('FOR UPDATE OF o SKIP LOCKED')) {
      return {rows:committed ? [] : events.slice(0,params[0])};
    }
    if (sql.startsWith('UPDATE privacy_erasure_delivery_outbox')) {
      staged=true;
      if (onUpdate) onUpdate();
      return {rowCount:1,rows:[{event_key:params[0]}]};
    }
    throw Error('Unexpected synthetic SQL: ' + sql);
  },release(){calls.push('RELEASE');}};
  let connects=0;
  const pool={async connect(){connects++;return db;}};
  return {pool,calls,get connections(){return connects;},
    get committed(){return committed;}};
}
function harness({env={...VALID_ENV}, events=[EVENT], dbOpts={}, exporterOverrides={}}={}) {
  const db=fakeDb(events,dbOpts);
  let configCalls=0, exports=0;
  const exporter={
    config(){configCalls++;return {bucket:'synthetic-no-network'};},
    async archiveEvent(event){exports++;return receipt(event);},
    ...exporterOverrides
  };
  const service=new PrivacyOfflineRecoveryExporter({
    env,exporter,clock:()=>new Date(NOW)
  });
  return {env,db,service,exporter,
    get configCalls(){return configCalls;},
    get exports(){return exports;}};
}

test('offline exporter requires explicit maintenance, disabled ordinary worker and operator attestations before I/O',async()=>{
  for(const [field,value] of [
    ['DEMOS_PRIVACY_RECOVERY_MAINTENANCE','false'],
    ['DEMOS_PRIVACY_RECOVERY_MAINTENANCE','TRUE'],
    ['DEMOS_PRIVACY_RECOVERY_MAINTENANCE',''],
    ['GDPR_ERASURE_RECOVERY_OFFLINE_EXPORT_ENABLED','false'],
    ['GDPR_ERASURE_OUTBOX_ENABLED','false'],
    ['GDPR_ERASURE_OUTBOX_WORKER_ENABLED','true'],
    ['GDPR_ERASURE_OUTBOX_WORKER_ENABLED','TRUE']
  ]){
    const h=harness({env:{...VALID_ENV,[field]:value}});
    await assert.rejects(h.service.runOnce(h.db.pool,fixture()),
      /requires explicit quarantine/);
    assert.equal(h.db.connections,0,'no PG connection for '+field);
    assert.equal(h.configCalls,0,'no B2 config for '+field);
    assert.equal(h.exports,0,'no B2 upload for '+field);
  }
  for(const missing of ['maintenanceConfirmed','quarantineConfirmed']){
    const h=harness();const options={...fixture(),[missing]:false};
    await assert.rejects(h.service.runOnce(h.db.pool,options),/operator quarantine attestation/);
    assert.equal(h.db.connections,0);
    assert.equal(h.configCalls,0);
  }
});

test('offline exporter refuses stale signed manifest or wrong signature before SQL/B2',async()=>{
  const older=fixture();
  const extra={...EVENT,event_key:'00000000-0000-4000-8000-000000000327',
    occurred_at:'2026-10-26T00:20:00.000Z'};
  const newest=fixture([EVENT,extra]);
  const h=harness();
  await assert.rejects(h.service.runOnce(h.db.pool,{
    ...older, expectedManifestDigest:newest.expectedManifestDigest
  }),/freshness checkpoint/);
  const tampered=structuredClone(older.envelope);
  tampered.payload.events[0].details.reason='altered';
  await assert.rejects(h.service.runOnce(h.db.pool,{
    ...older,envelope:tampered
  }),/signature invalid/);
  await assert.rejects(h.service.runOnce(h.db.pool,{
    ...older,limit:21
  }),/bounded batch/);
  assert.equal(h.db.connections,0);
  assert.equal(h.configCalls,0);
  assert.equal(h.exports,0);
});

test('offline exporter refuses incomplete, extra, orphaned or tampered restored history before B2',async()=>{
  for(const [name,dbOpts,expected] of [
    ['extra',{unapproved:true},/outside approved manifest/],
    ['missing',{missing:true},/missing approved external events/],
    ['orphan',{orphan:true},/missing or orphaned outbox/],
    ['tampered',{altered:true},/differs from approved external manifest/]
  ]){
    const h=harness({dbOpts});
    await assert.rejects(h.service.runOnce(h.db.pool,fixture()),expected,name);
    assert.equal(h.exports,0,name+' must not upload');
    assert.ok(h.db.calls.includes('ROLLBACK'),name);
    assert.ok(!h.db.calls.includes('COMMIT'),name);
  }
});

test('offline exporter rejects tampering of an ALREADY delivered event before pending PUT',async()=>{
  const delivered={...EVENT,
    event_key:'00000000-0000-4000-8000-000000000327',
    occurred_at:'2026-10-26T00:20:00.000Z'};
  const h=harness({events:[EVENT],dbOpts:{
    deliveredEvents:[delivered],tamperKey:delivered.event_key
  }});
  await assert.rejects(h.service.runOnce(h.db.pool,fixture([EVENT,delivered])),
    /differs from approved external manifest/);
  assert.equal(h.exports,0,'pending event must not PUT if delivered history is altered');
  assert.equal(h.db.calls.some(sql=>sql.includes('FOR UPDATE OF o SKIP LOCKED')),false);
  assert.ok(h.db.calls.includes('ROLLBACK'));
});

test('offline exporter verifies all 251 signed events across pages before ANY B2 upload',async()=>{
  const events=Array.from({length:251},(_,i)=>({
    ...EVENT,
    event_key:'00000000-0000-4000-8000-'+(i+1).toString(16).padStart(12,'0')
  }));
  const tamperedLast=events[250].event_key;
  const h=harness({events,dbOpts:{tamperKey:tamperedLast}});
  await assert.rejects(h.service.runOnce(h.db.pool,fixture(events)),
    /differs from approved external manifest/);
  assert.equal(h.exports,0,'later-page tamper must block first B2 PUT');
  assert.ok(h.db.calls.filter(sql=>sql.includes('WHERE event_key > $1')).length>=2);
  assert.ok(h.db.calls.includes('ROLLBACK'));
});

test('offline exporter acquires shared replay advisory lock before both table locks and B2',async()=>{
  const h=harness();
  await h.service.runOnce(h.db.pool,fixture());
  const schemaPin=h.db.calls.indexOf('SET LOCAL search_path = pg_catalog, public, pg_temp');
  const advisory=h.db.calls.findIndex(sql=>sql.includes('pg_advisory_xact_lock(170026, 296)'));
  const lock=h.db.calls.findIndex(sql=>sql.startsWith('LOCK TABLE'));
  const scan=h.db.calls.findIndex(sql=>sql.includes('WHERE event_key > $1'));
  const pending=h.db.calls.findIndex(sql=>sql.includes('FOR UPDATE OF o SKIP LOCKED'));
  assert.ok(h.db.calls[0].startsWith('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ'));
  assert.ok(schemaPin>0 && advisory>schemaPin,
    'transaction must select verified public schema BEFORE reading ledger/outbox');
  assert.ok(advisory>0 && lock>advisory && scan>lock && pending>scan,
    'consistent advisory-then-table lock order prevents inversion with signed replay');
  assert.match(h.db.calls[lock],/SHARE ROW EXCLUSIVE MODE NOWAIT/);
  assert.match(h.db.calls[scan],/to_char\(occurred_at AT TIME ZONE/);
  assert.match(h.db.calls[pending],/to_char\(l\.occurred_at AT TIME ZONE/);
});

test('offline exporter commits only signed event with valid immutable B2 receipt and never claims traffic ready',async()=>{
  const h=harness();
  const result=await h.service.runOnce(h.db.pool,fixture());
  assert.deepEqual(result,{recoveryId:ID,delivered:1,moreMayRemain:true,readyForTraffic:false});
  assert.equal(h.exports,1);
  assert.ok(h.db.calls.includes('COMMIT'));
  assert.ok(!h.db.calls.includes('ROLLBACK'));
  assert.ok(h.db.calls.includes('RELEASE'));
  assert.equal(h.db.calls.filter(x=>x.startsWith('UPDATE privacy_erasure_delivery_outbox')).length,1);
});

test('offline exporter rejects wrong B2 receipt, version or expiry with rollback',async()=>{
  const cases=[
    {name:'wrong sha',fn:e=>({...receipt(e),sha256:'f'.repeat(64)})},
    {name:'wrong event',fn:e=>({...receipt(e),eventKey:'another-event'})},
    {name:'no version',fn:e=>({...receipt(e),versionId:null})},
    {name:'missing retention',fn:e=>({...receipt(e),retentionUntil:null})},
    {name:'expired',fn:e=>({...receipt(e),retentionUntil:'2026-10-25T00:00:00.000Z'})}
  ];
  for(const scenario of cases){
    const h=harness({exporterOverrides:{async archiveEvent(e){return scenario.fn(e);}}});
    await assert.rejects(h.service.runOnce(h.db.pool,fixture()),
      /invalid immutable receipt|no valid COMPLIANCE retention/,scenario.name);
    assert.ok(h.db.calls.includes('ROLLBACK'),scenario.name);
    assert.equal(h.db.calls.includes('COMMIT'),false,scenario.name);
  }
});

test('offline exporter aborts and leaves pending when quarantine is lost during B2 call or SQL ACK',async()=>{
  const env={...VALID_ENV};
  const h=harness({env,exporterOverrides:{
    async archiveEvent(e){
      env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE='false';
      return receipt(e);
    }
  }});
  await assert.rejects(h.service.runOnce(h.db.pool,fixture()),/requires explicit quarantine/);
  assert.ok(h.db.calls.includes('ROLLBACK'));
  assert.equal(h.db.calls.some(s=>s.startsWith('UPDATE privacy_erasure_delivery_outbox')),false);
  assert.equal(h.db.calls.includes('COMMIT'),false);

  const env2={...VALID_ENV};
  const h2=harness({env:env2,dbOpts:{
    onUpdate:()=>{env2.GDPR_ERASURE_OUTBOX_WORKER_ENABLED='true';}
  }});
  await assert.rejects(h2.service.runOnce(h2.db.pool,fixture()),/requires explicit quarantine/);
  assert.ok(h2.db.calls.some(s=>s.startsWith('UPDATE privacy_erasure_delivery_outbox')));
  assert.ok(h2.db.calls.includes('ROLLBACK'));
  assert.equal(h2.db.calls.includes('COMMIT'),false);
});

test('offline exporter refuses success if quarantine is revoked during COMMIT',async()=>{
  const env={...VALID_ENV};
  let revokeOnce=true;
  const h=harness({env,dbOpts:{
    onCommit:()=>{
      if (revokeOnce) {
        revokeOnce=false;
        env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE='false';
      }
    }
  }});
  await assert.rejects(h.service.runOnce(h.db.pool,fixture()),/requires explicit quarantine/);
  assert.equal(h.db.committed,true,'SQL commit may already be durable');
  assert.equal(h.exports,1,'B2 write may already be durable');
  assert.ok(h.db.calls.includes('COMMIT'));
  assert.equal(h.db.calls.includes('ROLLBACK'),false,'durable commit cannot be rolled back');
  env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE='true';
  const retry=await h.service.runOnce(h.db.pool,fixture());
  assert.deepEqual(retry,{recoveryId:ID,delivered:0,moreMayRemain:false,readyForTraffic:false});
  assert.equal(h.exports,1,'already committed receipt must not be exported twice');
});

test('offline exporter rejects uncertain COMMIT and retries both synthetic durability outcomes',async()=>{
  for(const commitFault of ['before','after']){
    const h=harness({dbOpts:{commitFault}});
    await assert.rejects(h.service.runOnce(h.db.pool,fixture()),/synthetic commit/);
    assert.equal(h.db.committed,commitFault==='after',commitFault);
    assert.equal(h.exports,1);
    assert.ok(h.db.calls.includes('ROLLBACK'),'best-effort rollback on uncertain COMMIT');
    assert.ok(h.db.calls.includes('RELEASE'),'dedicated client released on failure');
    const retry=await h.service.runOnce(h.db.pool,fixture());
    assert.deepEqual(retry,{
      recoveryId:ID,delivered:commitFault==='before'?1:0,
      moreMayRemain:commitFault==='before',readyForTraffic:false
    },commitFault);
    assert.equal(h.db.committed,true);
    assert.equal(h.exports,commitFault==='before'?2:1,
      'retry exports only if SQL receipt remains pending');
  }
});
