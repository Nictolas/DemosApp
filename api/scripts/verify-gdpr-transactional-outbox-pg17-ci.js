'use strict';
/* Disposable PostgreSQL 17 ONLY; simulated immutable B2 (no network). */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { PrivacyErasureOutboxWorker } = require('../services/privacyErasureOutboxWorker');

const DATABASE='gdpr_erasure_outbox_ci';
function guard() {
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.GDPR_OUTBOX_SYNTHETIC_CI!=='isolated'||
     e.GDPR_ERASURE_OUTBOX_ENABLED!=='true' ||
     e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432' ||
     e.PGDATABASE!==DATABASE||e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only'||
     ['DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY',
       'RENDER','NEON_DATABASE_URL'].some(k=>Boolean(e[k]))) {
    throw Error('Refusing GDPR outbox test outside disposable local CI');
  }
}
const n=()=>crypto.randomUUID();
function syntheticEvent() {
  return {userId:n(),eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
    details:{source:'invented-pg17-outbox-ci'}};
}
async function value(db,sql,params=[]) {
  const response=await db.query(sql,params);
  return Number(Object.values(response.rows[0])[0]);
}
function fakeB2() {
  const objects=new Map();
  let failAfterPut=false,failBeforePut=false, barrier=null;
  const exporter={
    config(){return {bucket:'synthetic-b2-not-real'};},
    async archiveEvent(row){
      if(failBeforePut){ failBeforePut=false; throw Error('synthetic-b2-unavailable');}
      const prior=objects.get(row.event_key);
      const sha256=crypto.createHash('sha256').update(JSON.stringify({
        event_key:row.event_key,
        subject_user_id:row.subject_user_id,
        type:row.event_type,details:row.details
      })).digest('hex');
      if(prior && prior.sha256!==sha256) throw Error('immutable key collision');
      const receipt=prior||{eventKey:row.event_key,sha256,versionId:'immutable-version-ci'};
      objects.set(row.event_key,receipt);
      if(barrier){
        const gate=barrier;barrier=null;gate.started();
        await gate.resume;
      }
      if(failAfterPut){failAfterPut=false;throw Error('synthetic-network-lost-after-PUT');}
      return receipt;
    }
  };
  return {
    exporter,objects,
    failNextBeforePut(){failBeforePut=true;},
    failNextAfterPut(){failAfterPut=true;},
    setBarrier(b){barrier=b;}
  };
}
async function main() {
  guard();
  const pool=new Pool({host:'127.0.0.1',port:5432,database:DATABASE,
    user:'postgres',password:'synthetic-only',max:5,
    statement_timeout:15000,connectionTimeoutMillis:5000});
  try {
    const metadata=(await pool.query(
      "SELECT current_database() AS n,current_setting('server_version_num')::integer AS v"
    )).rows[0];
    assert.equal(metadata.n,DATABASE);
    assert.equal(Math.floor(metadata.v/10000),17);
    await Ledger.ensureTable(pool);

    const notInstalled=await PrivacyErasureOutboxWorker.status(pool);
    assert.equal(notInstalled.installed,false);
    assert.equal(notInstalled.ready,false);

    // Prior ledger events must be brought into the queue under a controlled
    // maintenance freeze BEFORE opt-in feature deployment.
    process.env.GDPR_ERASURE_OUTBOX_ENABLED='false';
    const legacy=await Ledger.recordEvent(pool,syntheticEvent());
    assert.ok(legacy.event_key);
    process.env.GDPR_ERASURE_OUTBOX_ENABLED='true';
    await assert.rejects(
      Ledger.backfillDeliveryOutbox(pool,{maintenanceConfirmed:false}),
      /maintenance/
    );
    assert.equal(await Ledger.backfillDeliveryOutbox(pool,{maintenanceConfirmed:true}),1);
    assert.equal(await Ledger.backfillDeliveryOutbox(pool,{maintenanceConfirmed:true}),0);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,1);

    const eventsBefore=await value(pool,'SELECT COUNT(*)::int FROM privacy_erasure_ledger');
    const pendingBefore=await value(pool,'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox');
    const aborted=await pool.connect();
    await aborted.query('BEGIN');
    const rollbackEvent=await Ledger.recordEvent(aborted,syntheticEvent());
    assert.ok(rollbackEvent.event_key);
    assert.equal(await value(aborted,'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox'),
      pendingBefore+1);
    await aborted.query('ROLLBACK');
    aborted.release();
    assert.equal(await value(pool,'SELECT COUNT(*)::int FROM privacy_erasure_ledger'),eventsBefore);
    assert.equal(await value(pool,'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox'),pendingBefore);

    // Atomic outbox CTE must also work without a surrounding BEGIN.
    const committed=await Ledger.recordEvent(pool,syntheticEvent());
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox WHERE event_key=$1',
      [committed.event_key]),1);
    const b2=fakeB2(),worker=new PrivacyErasureOutboxWorker({
      env:{GDPR_ERASURE_OUTBOX_ENABLED:'true',GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true'},
      exporter:b2.exporter
    });
    const off=new PrivacyErasureOutboxWorker({
      env:{GDPR_ERASURE_OUTBOX_ENABLED:'true',GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'false'},
      exporter:b2.exporter
    });
    await assert.rejects(off.runOnce(pool),/disabled/);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,2);

    b2.failNextBeforePut();
    await assert.rejects(worker.runOnce(pool,{limit:1}),/synthetic-b2-unavailable/);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,2);
    assert.equal(b2.objects.size,0);

    // Simulate successful immutable PUT but lost HTTP response. The retry must
    // read/reuse the exact same event key; pending row cannot disappear.
    b2.failNextAfterPut();
    await assert.rejects(worker.runOnce(pool,{limit:1}),/synthetic-network-lost-after-PUT/);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,2);
    assert.equal(b2.objects.size,1);
    const first=await worker.runOnce(pool,{limit:1});
    assert.equal(first.delivered,1);
    assert.equal(b2.objects.size,1);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,1);

    // The B2 PUT may succeed while the PostgreSQL UPDATE/COMMIT fails.
    // A retry must be harmless and able to confirm the same event version.
    const faultPool={async connect(){
      const client=await pool.connect();
      return {
        async query(sql,params){
          if(String(sql).startsWith('UPDATE privacy_erasure_delivery_outbox')) {
            throw Error('synthetic-ack-transaction-failure');
          }
          return client.query(sql,params);
        },
        release(){client.release();}
      };
    }};
    await assert.rejects(worker.runOnce(faultPool,{limit:1}),/synthetic-ack-transaction-failure/);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,1);
    assert.equal(b2.objects.size,2);
    assert.equal((await worker.runOnce(pool,{limit:1})).delivered,1);
    assert.equal(b2.objects.size,2);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).ready,true);
    assert.equal((await worker.runOnce(pool,{limit:1})).delivered,0);

    // Two concurrent consumers must never export the same pending row.
    const latest=await Ledger.recordEvent(pool,syntheticEvent());
    let signalStarted;
    let signalResume;
    const started=new Promise(resolve=>{signalStarted=resolve;});
    const resume=new Promise(resolve=>{signalResume=resolve;});
    b2.setBarrier({started:signalStarted,resume});
    const firstWorker=worker.runOnce(pool,{limit:1});
    await Promise.race([started,new Promise((_,reject)=>
      setTimeout(()=>reject(Error('SKIP LOCKED barrier timeout')),10000))]);
    const secondWorker=await worker.runOnce(pool,{limit:1});
    assert.equal(secondWorker.delivered,0);
    signalResume();
    assert.equal((await firstWorker).delivered,1);
    assert.ok(b2.objects.has(latest.event_key));
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,0);
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox WHERE delivered_at IS NULL'),0);
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox WHERE delivered_at IS NOT NULL'),3);

    console.log('GDPR_TRANSACTIONAL_OUTBOX_PG17_PASS '+JSON.stringify({
      synthetic:true,transactionRollbackAtomic:true,
      historicalBackfillIdempotent:true,oneStatementAutocommit:true,
      networkFailureRetry:true,postPutFailureRetry:true,failedDatabaseAckRetry:true,
      concurrentSkipLocked:true,noMissingEvents:true,productionUntouched:true
    }));
  } finally {
    await pool.end();
  }
}
main().catch(error=>{
  console.error('GDPR_TRANSACTIONAL_OUTBOX_PG17_FAIL',error);
  process.exitCode=1;
});
