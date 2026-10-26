'use strict';
/* Disposable PostgreSQL 17 ONLY; simulated immutable B2 (no network). */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { PrivacyErasureOutboxWorker } = require('../services/privacyErasureOutboxWorker');
const { verifyOutboxRecoveryReadiness } = require('../services/privacyOutboxRecoveryReadiness');
const { signature, manifestDigest } = require('../services/privacyRecoveryGateService');

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
    async verifyArchivedReceipt(event,receipt){
      const stored=objects.get(event.event_key);
      if(!stored||receipt.versionId!==stored.versionId||receipt.sha256!==stored.sha256) {
        throw Error('synthetic-remote-receipt-mismatch');
      }
      return stored;
    },
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
    // Both schemas absent: enabling the new feature must not create either
    // table from a user request, even before any maintenance bootstrap.
    const beforeSchema=await pool.query(
      "SELECT to_regclass('public.privacy_erasure_ledger') AS ledger, " +
      "to_regclass('public.privacy_erasure_delivery_outbox') AS outbox"
    );
    assert.deepEqual(beforeSchema.rows[0],{ledger:null,outbox:null});
    await assert.rejects(
      Ledger.recordEvent(pool,syntheticEvent()),
      error=>error.code==='42P01'
    );
    const afterSchema=await pool.query(
      "SELECT to_regclass('public.privacy_erasure_ledger') AS ledger, " +
      "to_regclass('public.privacy_erasure_delivery_outbox') AS outbox"
    );
    assert.deepEqual(afterSchema.rows[0],{ledger:null,outbox:null},
      'GDPR request must not create any database schema');
    // The explicit legacy/bootstrap path remains supported.
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
    // No DDL may run on the user-facing write path. A missing outbox table
    // must cause a failed SQL statement, leaving the ledger unchanged.
    await assert.rejects(Ledger.recordEvent(pool,syntheticEvent()),
      error=>error.code==='42P01');
    assert.equal(await value(pool,'SELECT COUNT(*)::int FROM privacy_erasure_ledger'),1);
    await assert.rejects(
      Ledger.backfillDeliveryOutbox(pool,{maintenanceConfirmed:false}),
      /maintenance/
    );
    assert.equal(await Ledger.backfillDeliveryOutbox(pool,{maintenanceConfirmed:true}),1);
    assert.equal(await Ledger.backfillDeliveryOutbox(pool,{maintenanceConfirmed:true}),0);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,1);
    const b2=fakeB2();
    // Synthetic stand-in for an independently approved, immutable checkpoint.
    // Never use this DB-derived approval process on a real recovery.
    const secret='synthetic-only-outbox-checkpoint-key-over-32-bytes';
    const recoveryId='outbox_ci_20261026';
    let approvedCheckpoint;
    const pinSnapshot=async()=>{
      const events=(await pool.query(
        'SELECT event_key,subject_user_id,event_type,occurred_at,details ' +
        'FROM privacy_erasure_ledger ORDER BY occurred_at,event_key'
      )).rows;
      const payload={
        formatVersion:1,recoveryId,
        restoredBackupTakenAt:'2026-01-01T00:00:00.000Z',
        capturedAt:new Date(Date.now()+60000).toISOString(),events
      };
      const envelope={payload,signature:signature(payload,secret)};
      approvedCheckpoint={
        envelope,secret,expectedRecoveryId:recoveryId,
        expectedManifestDigest:manifestDigest(envelope),
        expectedRestoredBackupTakenAt:payload.restoredBackupTakenAt,
        expectedCapturedAt:payload.capturedAt
      };
    };
    await pinSnapshot();
    const readiness=async opts=>{
      // A multi-query transaction MUST use a dedicated pg client.
      const client=await pool.connect();
      try {
        return await verifyOutboxRecoveryReadiness(client,{
          exporter:b2.exporter,maintenanceConfirmed:true,...approvedCheckpoint,...opts
        });
      } finally {client.release();}
    };
    await assert.rejects(verifyOutboxRecoveryReadiness({
      query(){throw Error('unexpected-sql')}
    },{exporter:b2.exporter}),/quarantine/);
    await assert.rejects(readiness(),/no verified external delivery receipt/);

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
    // Both rows are pending here: UUID ordering can cause a missing receipt
    // to fail before the unapproved event is reached. Do not make this
    // assertion depend on random UUID order; test the manifest rejection
    // deterministically below once all approved receipts are delivered.
    await assert.rejects(readiness(),
      /absent from approved external manifest|no verified external delivery receipt/);
    await pinSnapshot();
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox WHERE event_key=$1',
      [committed.event_key]),1);
    const worker=new PrivacyErasureOutboxWorker({
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
    assert.deepEqual(await readiness({pageSize:1}),{ready:true,verifiedEvents:2,pinnedEvents:2});
    // Once every approved event has a valid receipt, a newly committed
    // unapproved ledger event MUST be rejected regardless of UUID order.
    const unapproved=await Ledger.recordEvent(pool,syntheticEvent());
    await assert.rejects(readiness(),/absent from approved external manifest/);
    // Disposable CI fixture cleanup; never delete a real GDPR ledger event.
    await pool.query('DELETE FROM privacy_erasure_delivery_outbox WHERE event_key=$1',
      [unapproved.event_key]);
    await pool.query('DELETE FROM privacy_erasure_ledger WHERE event_key=$1',
      [unapproved.event_key]);
    assert.deepEqual(await readiness({pageSize:1}),{ready:true,verifiedEvents:2,pinnedEvents:2});
    await assert.rejects(readiness({maxEvents:1,pageSize:1}),/safety cap/);
    // An unqueued historical event must make even the zero-pending summary
    // fail; the operator cannot mistake "no work queued" for "all events".
    const removed=await pool.query('DELETE FROM privacy_erasure_delivery_outbox WHERE event_key=$1',[committed.event_key]);
    assert.equal(removed.rowCount,1);
    const incomplete=await PrivacyErasureOutboxWorker.status(pool);
    assert.equal(incomplete.pending,0);
    assert.equal(incomplete.unqueued,1);
    assert.equal(incomplete.ready,false);
    await assert.rejects(readiness(),/no verified external delivery receipt/);
    assert.equal(await Ledger.backfillDeliveryOutbox(pool,{maintenanceConfirmed:true}),1);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,1);
    // Re-deliver the repaired missing receipt and recheck the remote version.
    assert.equal((await worker.runOnce(pool,{limit:1})).delivered,1);
    assert.deepEqual(await readiness(),{ready:true,verifiedEvents:2,pinnedEvents:2});
    // A plausible-looking but forged local receipt cannot satisfy the B2 read.
    await pool.query('UPDATE privacy_erasure_delivery_outbox SET b2_sha256=$2 WHERE event_key=$1',
      [committed.event_key,'f'.repeat(64)]);
    await assert.rejects(readiness(),/synthetic-remote-receipt-mismatch/);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).ready,true,
      'database-only readiness cannot independently verify remote contents');
    await pool.query('UPDATE privacy_erasure_delivery_outbox SET b2_sha256=$2 WHERE event_key=$1',
      [committed.event_key,b2.objects.get(committed.event_key).sha256]);
    // Even with locally valid receipts, a deleted remote version is a blocker.
    const lost=b2.objects.get(committed.event_key);
    b2.objects.delete(committed.event_key);
    await assert.rejects(readiness(),/synthetic-remote-receipt-mismatch/);
    b2.objects.set(committed.event_key,lost);
    assert.deepEqual(await readiness(),{ready:true,verifiedEvents:2,pinnedEvents:2});

    // A legacy/corrupted restore may contain a delivery row without its
    // ledger event. Bypass the FK trigger ONLY in this guarded disposable
    // PostgreSQL 17 CI database to reproduce that otherwise forbidden state.
    const orphanKey = n();
    const corruptFixture = await pool.connect();
    try {
      await corruptFixture.query('SET session_replication_role = replica');
      try {
        await corruptFixture.query(
          'INSERT INTO privacy_erasure_delivery_outbox(event_key) VALUES ($1)',
          [orphanKey]
        );
      } finally {
        await corruptFixture.query('SET session_replication_role = origin');
      }
    } finally {corruptFixture.release();}
    const orphanSummary = await PrivacyErasureOutboxWorker.status(pool);
    assert.equal(orphanSummary.pending,0);
    assert.equal(orphanSummary.unqueued,0);
    assert.equal(orphanSummary.orphaned,1);
    assert.equal(orphanSummary.ready,false);
    await assert.rejects(readiness(),/orphaned events/);
    // Remove ONLY the invented inconsistent fixture, not any real evidence.
    await pool.query('DELETE FROM privacy_erasure_delivery_outbox WHERE event_key=$1',
      [orphanKey]);
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).orphaned,0);
    assert.deepEqual(await readiness(),{ready:true,verifiedEvents:2,pinnedEvents:2});

    // Simulate a truncated restored ledger while keeping an independently
    // pinned manifest with two events. Readback of every remaining B2 version
    // must NOT report ready: the absent event is detected at end-of-scan.
    const truncatedClient=await pool.connect();
    try {
      const missingRowClient={
        async query(sql,params) {
          const response=await truncatedClient.query(sql,params);
          if (String(sql).includes('FROM privacy_erasure_ledger l ')) {
            return {...response,rows:response.rows.filter(
              row=>row.event_key!==committed.event_key
            )};
          }
          return response;
        }
      };
      await assert.rejects(verifyOutboxRecoveryReadiness(missingRowClient,{
        exporter:b2.exporter,maintenanceConfirmed:true,...approvedCheckpoint
      }),/events missing from restored ledger/);
      const modifiedRowClient={
        async query(sql,params) {
          const response=await truncatedClient.query(sql,params);
          if (String(sql).includes('FROM privacy_erasure_ledger l ')) {
            return {...response,rows:response.rows.map(row=>
              row.event_key===committed.event_key
                ? {...row,details:{source:'tampered-local-ledger'}}
                : row)};
          }
          return response;
        }
      };
      await assert.rejects(verifyOutboxRecoveryReadiness(modifiedRowClient,{
        exporter:b2.exporter,maintenanceConfirmed:true,...approvedCheckpoint
      }),/conflicts with approved external manifest/);
    } finally {truncatedClient.release();}

    // Two concurrent consumers must never export the same pending row.
    const latest=await Ledger.recordEvent(pool,syntheticEvent());
    await pinSnapshot();
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
    assert.deepEqual(await readiness({pageSize:1}),{ready:true,verifiedEvents:3,pinnedEvents:3});
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox WHERE delivered_at IS NULL'),0);
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox WHERE delivered_at IS NOT NULL'),3);

    console.log('GDPR_TRANSACTIONAL_OUTBOX_PG17_PASS '+JSON.stringify({
      synthetic:true,transactionRollbackAtomic:true,
      historicalBackfillIdempotent:true,oneStatementAutocommit:true,
      networkFailureRetry:true,postPutFailureRetry:true,failedDatabaseAckRetry:true,
      concurrentSkipLocked:true,noMissingEvents:true,
      missingOutboxFailsClosed:true,missingHistoricalRowsDetected:true,
      orphanedOutboxRejectedBySummaryAndReadiness:true,
      missingLedgerFailsWithoutDDL:true,
      externalReceiptReadbackRequired:true,remoteTamperRejected:true,
      productionUntouched:true
    }));
  } finally {
    await pool.end();
  }
}
main().catch(error=>{
  console.error('GDPR_TRANSACTIONAL_OUTBOX_PG17_FAIL',error);
  process.exitCode=1;
});
