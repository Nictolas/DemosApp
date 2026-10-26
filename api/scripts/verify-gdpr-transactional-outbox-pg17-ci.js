'use strict';
/* Disposable PostgreSQL 17 ONLY; simulated immutable B2 (no network). */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { PrivacyErasureOutboxWorker } = require('../services/privacyErasureOutboxWorker');
const { PrivacyErasureB2Journal, normalizeEvent: normalizeB2Event } = require('../services/privacyErasureB2Journal');
const { PrivacyOfflineRecoveryExporter } = require('../services/privacyOfflineRecoveryExporter');
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
      // Synthetic stand-in for the COMPLIANCE expiry returned by real B2
      // GetObjectRetention; no network or real bucket is used by this drill.
      const receipt=prior||{eventKey:row.event_key,sha256,
        versionId:'immutable-version-ci',
        retentionUntil:new Date(Date.now()+30*24*60*60*1000).toISOString()};
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
    // A pooled PostgreSQL session can prefer pg_temp or another schema.
    // Exercise both live outbox and legacy writes, explicit maintenance
    // bootstrap/backfill, capture and import against shadow tables. A bare
    // relation name would either fail on missing columns or hit the shadow.
    const writerShadow=await pool.connect();
    const shadowKeys=[];
    try {
      await writerShadow.query(
        'CREATE TEMP TABLE privacy_erasure_ledger (event_key text PRIMARY KEY)'
      );
      await writerShadow.query(
        'CREATE TEMP TABLE privacy_erasure_delivery_outbox (event_key text PRIMARY KEY)'
      );
      await writerShadow.query('SET search_path TO pg_temp, public');
      const outboxEvent=await Ledger.recordEvent(writerShadow,syntheticEvent());
      shadowKeys.push(outboxEvent.event_key);
      assert.equal(await value(writerShadow,
        'SELECT count(*)::int FROM public.privacy_erasure_delivery_outbox WHERE event_key=$1',
        [outboxEvent.event_key]),1,'outbox mode must queue in public');
      process.env.GDPR_ERASURE_OUTBOX_ENABLED='false';
      try {
        const legacyEvent=await Ledger.recordEvent(writerShadow,syntheticEvent());
        shadowKeys.push(legacyEvent.event_key);
        assert.equal(await value(writerShadow,
          'SELECT count(*)::int FROM public.privacy_erasure_ledger WHERE event_key=$1',
          [legacyEvent.event_key]),1,'legacy mode must write public ledger');
      } finally {
        process.env.GDPR_ERASURE_OUTBOX_ENABLED='true';
      }
      const captured=await Ledger.captureCurrent(writerShadow);
      assert.ok(captured.some(row=>row.event_key===outboxEvent.event_key),
        'capture must read public ledger rather than empty shadow');
      const imported={
        event_key:n(),subject_user_id:n(),
        event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        occurred_at:new Date().toISOString(),
        details:{source:'synthetic-shadow-import'}
      };
      shadowKeys.push(imported.event_key);
      assert.equal(await Ledger.mergeCaptured(writerShadow,[imported],{
        requirePreinstalled:true
      }),1,'offline import must target public ledger');
      assert.equal(await Ledger.backfillDeliveryOutbox(writerShadow,{
        maintenanceConfirmed:true
      }),2,'maintenance backfill must queue legacy and imported public events');
      assert.equal(await Ledger.backfillDeliveryOutbox(writerShadow,{
        maintenanceConfirmed:true
      }),0,'maintenance backfill remains idempotent under shadow');
      assert.equal(await value(writerShadow,
        'SELECT count(*)::int FROM public.privacy_erasure_delivery_outbox '+
        'WHERE event_key=ANY($1::text[])',shadowKeys),3);
      assert.equal(await value(writerShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_ledger'),0);
      assert.equal(await value(writerShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_delivery_outbox'),0);
      assert.equal((await writerShadow.query('SHOW search_path')).rows[0].search_path,
        'pg_temp, public','writer/bootstrap must not alter session settings');
    } finally {
      process.env.GDPR_ERASURE_OUTBOX_ENABLED='true';
      // Delete only disposable fixture events; no production data exists here.
      await writerShadow.query(
        'DELETE FROM public.privacy_erasure_delivery_outbox WHERE event_key=ANY($1::text[])',
        [shadowKeys]
      );
      await writerShadow.query(
        'DELETE FROM public.privacy_erasure_ledger WHERE event_key=ANY($1::text[])',
        [shadowKeys]
      );
      await writerShadow.query('RESET search_path');
      await writerShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_delivery_outbox');
      await writerShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_ledger');
      writerShadow.release();
    }
    assert.equal((await PrivacyErasureOutboxWorker.status(pool)).pending,1,
      'synthetic shadow fixture cleanup must preserve preexisting ledger');
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
    // A dedicated PostgreSQL connection may have a hostile/stale search_path
    // and pg_temp shadows of the verified public ledger/outbox. Read-only
    // recovery must not read these fake tables or report on their contents.
    const readinessShadow=await pool.connect();
    try {
      await readinessShadow.query(
        'CREATE TEMP TABLE privacy_erasure_ledger (event_key text PRIMARY KEY)'
      );
      await readinessShadow.query(
        'CREATE TEMP TABLE privacy_erasure_delivery_outbox (event_key text PRIMARY KEY)'
      );
      await readinessShadow.query('SET search_path TO pg_temp, public');
      const verified=await verifyOutboxRecoveryReadiness(readinessShadow,{
        exporter:b2.exporter,maintenanceConfirmed:true,...approvedCheckpoint,
        pageSize:1
      });
      assert.deepEqual(verified,{ready:true,verifiedEvents:2,pinnedEvents:2});
      assert.equal(await value(readinessShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_ledger'),0);
      assert.equal(await value(readinessShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_delivery_outbox'),0);
      assert.equal((await readinessShadow.query('SHOW search_path')).rows[0].search_path,
        'pg_temp, public','readiness must not change the session setting');
    } finally {
      await readinessShadow.query('RESET search_path');
      await readinessShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_delivery_outbox');
      await readinessShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_ledger');
      readinessShadow.release();
    }
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
          'INSERT INTO privacy_erasure_delivery_outbox ' +
          '(event_key,delivered_at,b2_version_id,b2_sha256) ' +
          'VALUES ($1,NOW(),$2,$3)',
          [orphanKey,'synthetic-orphan-version','a'.repeat(64)]
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

    // Ordinary worker and its local status endpoint must also resist a
    // borrowed PG17 session resolving pg_temp before public. The temporary
    // relations deliberately lack delivered_at/queued_at; using them would
    // fail the status check or prevent delivery of the real pending event.
    const shadowPending=await Ledger.recordEvent(pool,syntheticEvent());
    const workerShadow=await pool.connect();
    try {
      await workerShadow.query(
        'CREATE TEMP TABLE privacy_erasure_ledger (event_key text PRIMARY KEY)'
      );
      await workerShadow.query(
        'CREATE TEMP TABLE privacy_erasure_delivery_outbox (event_key text PRIMARY KEY)'
      );
      await workerShadow.query('SET search_path TO pg_temp, public');
      const before=await PrivacyErasureOutboxWorker.status(workerShadow);
      assert.equal(before.pending,1,'status must read the public pending event');
      assert.equal(before.ready,false,'pending public event prevents local readiness');
      const shadowPool={async connect(){return {
        query:(sql,params)=>workerShadow.query(sql,params),
        release(){}
      };}};
      assert.equal((await worker.runOnce(shadowPool,{limit:1})).delivered,1);
      assert.ok(b2.objects.has(shadowPending.event_key),
        'ordinary worker must export the verified public pending event');
      const after=await PrivacyErasureOutboxWorker.status(workerShadow);
      assert.equal(after.pending,0);
      assert.equal(after.unqueued,0);
      assert.equal(after.orphaned,0);
      assert.equal(after.ready,true,'local status only, not B2 recovery readiness');
      assert.equal(await value(workerShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_ledger'),0);
      assert.equal(await value(workerShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_delivery_outbox'),0);
      assert.equal((await workerShadow.query('SHOW search_path')).rows[0].search_path,
        'pg_temp, public','ordinary worker must not change session settings');
    } finally {
      await workerShadow.query('RESET search_path');
      await workerShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_delivery_outbox');
      await workerShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_ledger');
      workerShadow.release();
    }

    // Verify microsecond pagination against REAL disposable PostgreSQL 17,
    // not just a JS mock of the to_char() expression.
    const cursorClient = await pool.connect();
    try {
      await cursorClient.query('BEGIN');
      // A transaction-local shadow table ensures exactly two invented events.
      // No production schema or external B2 service is touched.
      await cursorClient.query(
        'CREATE TEMP TABLE privacy_erasure_ledger ' +
        '(LIKE public.privacy_erasure_ledger INCLUDING DEFAULTS) ON COMMIT DROP'
      );
      const earlyKey='ffffffff-ffff-4fff-8fff-ffffffffffff';
      const lateKey='00000000-0000-4000-8000-000000000001';
      for (const [key,time] of [
        [earlyKey,'2026-10-26T03:00:00.000123Z'],
        [lateKey,'2026-10-26T03:00:00.000987Z']
      ]) {
        await cursorClient.query(
          'INSERT INTO privacy_erasure_ledger ' +
          '(event_key,subject_user_id,event_type,occurred_at,details) ' +
          'VALUES($1,$2,$3,$4::timestamptz,$5::jsonb)',
          [key,n(),Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,time,
            JSON.stringify({source:'invented-microsecond-ci'})]
        );
      }
      // archiveEvent is an in-memory stand-in: archiveBatch still performs its
      // actual SQL against the temporary PG17 ledger, but never contacts B2.
      const archive = new PrivacyErasureB2Journal({
        env:{
          GDPR_LEDGER_B2_ENABLED:'true',
          GDPR_LEDGER_B2_BUCKET:'synthetic-gdpr-b2-ci',
          GDPR_LEDGER_B2_REGION:'eu-central-003',
          GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
          GDPR_LEDGER_B2_ACCESS_KEY_ID:'synthetic-ci',
          GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'synthetic-ci',
          GDPR_LEDGER_B2_RETENTION_DAYS:'30',
          B2_BUCKET_NAME:'separate-synthetic-ci'
        }
      });
      const archived=[];
      archive.archiveEvent=async event=>{
        archived.push(event.event_key);
        return {eventKey:event.event_key,versionId:'fake-ci-only'};
      };
      const page1=await archive.archiveBatch(cursorClient,{limit:1});
      assert.equal(page1.cursor.occurred_at,'2026-10-26T03:00:00.000123Z');
      assert.equal(page1.cursor.event_key,earlyKey);
      // The caller must not convert the exact cursor to Date/toISOString:
      // doing so would truncate the microseconds and repeat page 1.
      const archivedBefore=archived.length;
      await assert.rejects(archive.archiveBatch(cursorClient,{
        after:{...page1.cursor,occurred_at:new Date(page1.cursor.occurred_at)},
        limit:1
      }),/Invalid archive cursor/);
      await assert.rejects(archive.archiveBatch(cursorClient,{
        after:{...page1.cursor,occurred_at:new Date(page1.cursor.occurred_at).toISOString()},
        limit:1
      }),/Invalid archive cursor/);
      assert.equal(archived.length,archivedBefore);
      const page2=await archive.archiveBatch(cursorClient,{after:page1.cursor,limit:1});
      assert.equal(page2.cursor.occurred_at,'2026-10-26T03:00:00.000987Z');
      assert.equal(page2.cursor.event_key,lateKey);
      const page3=await archive.archiveBatch(cursorClient,{after:page2.cursor,limit:1});
      assert.equal(page3.exported,0);
      assert.deepEqual(archived,[earlyKey,lateKey]);
    } finally {
      await cursorClient.query('ROLLBACK');
      cursorClient.release();
    }

    // Recovery flag switched while an archive was in flight. In a real
    // database, a successful immutable PUT must NOT commit the local ACK
    // after maintenance is engaged; the queued row remains retryable.
    const maintenanceEvent=await Ledger.recordEvent(pool,syntheticEvent());
    const maintenanceEnv={
      GDPR_ERASURE_OUTBOX_ENABLED:'true',
      GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true',
      DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'false'
    };
    const guardedExporter={
      config:()=>b2.exporter.config(),
      archiveEvent:async row=>{
        const receipt=await b2.exporter.archiveEvent(row);
        maintenanceEnv.DEMOS_PRIVACY_RECOVERY_MAINTENANCE='true';
        return receipt;
      }
    };
    const maintenanceWorker=new PrivacyErasureOutboxWorker({
      env:maintenanceEnv,exporter:guardedExporter
    });
    await assert.rejects(maintenanceWorker.runOnce(pool,{limit:1}),
      /blocked during recovery maintenance/);
    assert.ok(b2.objects.has(maintenanceEvent.event_key),
      'B2 upload may complete before the maintenance switch');
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox '+
      'WHERE event_key=$1 AND delivered_at IS NULL',
      [maintenanceEvent.event_key]),1,
    'maintenance must rollback the delivery marker');
    // No work may start under maintenance, even when B2 already holds the
    // exact immutable event and the worker could otherwise reuse it.
    await assert.rejects(maintenanceWorker.runOnce(pool,{limit:1}),
      /blocked during recovery maintenance/);
    maintenanceEnv.DEMOS_PRIVACY_RECOVERY_MAINTENANCE='false';
    const afterFreeze=new PrivacyErasureOutboxWorker({
      env:maintenanceEnv,exporter:b2.exporter
    });
    assert.equal((await afterFreeze.runOnce(pool,{limit:1})).delivered,1);
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox '+
      'WHERE event_key=$1 AND delivered_at IS NOT NULL',
      [maintenanceEvent.event_key]),1);

    // Separate offline exporter during a quarantined recovery, using ONLY
    // disposable PG17 and a simulated immutable B2 receipt. The ordinary
    // worker stays disabled; the public HTTP maintenance flag remains true.
    const offlinePending=await Ledger.recordEvent(pool,syntheticEvent());
    await pinSnapshot();
    const offlineEnv={
      DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'true',
      GDPR_ERASURE_OUTBOX_ENABLED:'true',
      GDPR_ERASURE_RECOVERY_OFFLINE_EXPORT_ENABLED:'true',
      GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'false'
    };
    const offlineObjects=new Map();
    let offlinePuts=0, configChecks=0, failAfterRemote=true;
    const offlineExporter={
      config(){configChecks++;return {bucket:'synthetic-offline-recovery'};},
      async archiveEvent(row){
        offlinePuts++;
        const canonical=normalizeB2Event(row);
        const sha256=crypto.createHash('sha256')
          .update(JSON.stringify(canonical)).digest('hex');
        const previous=offlineObjects.get(row.event_key);
        const saved=previous||{
          eventKey:row.event_key,versionId:'synthetic-offline-locked-version',
          sha256,retentionUntil:new Date(Date.now()+86400000).toISOString()
        };
        offlineObjects.set(row.event_key,saved);
        assert.equal(saved.sha256,sha256);
        if(failAfterRemote){
          failAfterRemote=false;
          // A separate incident operator withdrew local authorization after
          // a remote immutable PUT, but BEFORE the database ACK was committed.
          offlineEnv.GDPR_ERASURE_RECOVERY_OFFLINE_EXPORT_ENABLED='false';
        }
        return saved;
      }
    };
    const offlineRunner=new PrivacyOfflineRecoveryExporter({
      env:offlineEnv,exporter:offlineExporter
    });
    await assert.rejects(offlineRunner.runOnce(pool,{
      ...approvedCheckpoint,
      expectedManifestDigest:'f'.repeat(64),
      maintenanceConfirmed:true,quarantineConfirmed:true,limit:1
    }),/freshness checkpoint/);
    assert.equal(configChecks,0,'stale independent pin must reject before B2');
    assert.equal(offlinePuts,0);
    // PostgreSQL 17 replay/export coordination: a signed-ledger replay first
    // holds the shared transaction-scoped advisory lock. The exporter MUST
    // wait on that lock before trying either relation lock; acquiring the
    // relation lock first could deadlock against replay's pending SQL writes.
    const replayHoldingAdvisory=await pool.connect();
    try {
      await replayHoldingAdvisory.query('BEGIN');
      await replayHoldingAdvisory.query('SELECT pg_advisory_xact_lock(170026, 296)');
      const probeSql=[];
      const probePool={async connect(){
        const pgClient=await pool.connect();
        return {
          async query(sql,params){
            probeSql.push(sql);
            const response=await pgClient.query(sql,params);
            if(sql.startsWith('BEGIN TRANSACTION')) {
              // Local to this transaction, never a DB-wide configuration.
              await pgClient.query("SET LOCAL lock_timeout = '250ms'");
            }
            return response;
          },
          release(){pgClient.release();}
        };
      }};
      await assert.rejects(offlineRunner.runOnce(probePool,{
        ...approvedCheckpoint,maintenanceConfirmed:true,
        quarantineConfirmed:true,limit:1
      }),error=>error.code==='55P03',
      'offline exporter must wait for replay advisory lock without holding table locks');
      assert.ok(probeSql.some(sql=>sql.includes('pg_advisory_xact_lock(170026, 296)')));
      assert.equal(probeSql.some(sql=>sql.startsWith('LOCK TABLE')),false,
        'no table write-exclusion lock may precede shared replay advisory lock');
      assert.equal(offlinePuts,0,'advisory lock wait must precede B2 PUT');
    } finally {
      await replayHoldingAdvisory.query('ROLLBACK');
      replayHoldingAdvisory.release();
    }
    // Real PostgreSQL 17 concurrency: another writer's ROW EXCLUSIVE lock
    // must make the offline export fail NOWAIT before any remote B2 call.
    const concurrentWriter=await pool.connect();
    try {
      await concurrentWriter.query('BEGIN');
      await concurrentWriter.query(
        'UPDATE privacy_erasure_ledger SET details=details WHERE event_key=$1',
        [offlinePending.event_key]
      );
      const putsBeforeLock=offlinePuts;
      await assert.rejects(offlineRunner.runOnce(pool,{
        ...approvedCheckpoint,maintenanceConfirmed:true,
        quarantineConfirmed:true,limit:1
      }),error=>error.code==='55P03',
      'offline exporter must reject a concurrent ledger writer');
      assert.equal(offlinePuts,putsBeforeLock,
        'write-exclusion failure must precede B2 PUT');
      assert.equal(await value(pool,
        'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox '+
        'WHERE event_key=$1 AND delivered_at IS NULL',
        [offlinePending.event_key]),1);
    } finally {
      await concurrentWriter.query('ROLLBACK');
      concurrentWriter.release();
    }
    await assert.rejects(offlineRunner.runOnce(pool,{
      ...approvedCheckpoint,maintenanceConfirmed:true,
      quarantineConfirmed:true,limit:1
    }),/requires explicit quarantine/);
    assert.equal(offlinePuts,1);
    assert.equal(offlineObjects.size,1,
      'the remote PUT was completed by the fake exporter');
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox '+
      'WHERE event_key=$1 AND delivered_at IS NULL',
      [offlinePending.event_key]),1,
    'withdrawn recovery authorization must rollback the SQL ACK');
    // Ordinary workers remain forbidden during maintenance: this is NOT a
    // switch back to production service and is NOT recovery readiness.
    const ordinaryDuringFreeze=new PrivacyErasureOutboxWorker({
      env:{...offlineEnv,GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true'},
      exporter:offlineExporter
    });
    await assert.rejects(ordinaryDuringFreeze.runOnce(pool),
      /blocked during recovery maintenance/);
    offlineEnv.GDPR_ERASURE_RECOVERY_OFFLINE_EXPORT_ENABLED='true';
    // Repeat the successful offline retry on a borrowed client whose session
    // deliberately resolves temporary names before public. Only the verified
    // public ledger/outbox may be read or ACKed by the recovery exporter.
    const exporterShadow=await pool.connect();
    let recovered;
    try {
      await exporterShadow.query(
        'CREATE TEMP TABLE privacy_erasure_ledger (event_key text PRIMARY KEY)'
      );
      await exporterShadow.query(
        'CREATE TEMP TABLE privacy_erasure_delivery_outbox (event_key text PRIMARY KEY)'
      );
      await exporterShadow.query('SET search_path TO pg_temp, public');
      const shadowPool={async connect(){return {
        query:(sql,params)=>exporterShadow.query(sql,params),
        release(){}
      };}};
      recovered=await offlineRunner.runOnce(shadowPool,{
        ...approvedCheckpoint,maintenanceConfirmed:true,
        quarantineConfirmed:true,limit:1
      });
      assert.equal(await value(exporterShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_ledger'),0);
      assert.equal(await value(exporterShadow,
        'SELECT count(*)::int FROM pg_temp.privacy_erasure_delivery_outbox'),0);
      assert.equal((await exporterShadow.query('SHOW search_path')).rows[0].search_path,
        'pg_temp, public','offline export must not change session settings');
    } finally {
      await exporterShadow.query('RESET search_path');
      await exporterShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_delivery_outbox');
      await exporterShadow.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_ledger');
      exporterShadow.release();
    }
    assert.deepEqual(recovered,{
      recoveryId:recoveryId,delivered:1,moreMayRemain:true,readyForTraffic:false
    });
    assert.equal(offlineObjects.size,1,'retry must reuse same immutable object');
    assert.equal(await value(pool,
      'SELECT COUNT(*)::int FROM privacy_erasure_delivery_outbox '+
      'WHERE event_key=$1 AND delivered_at IS NOT NULL',
      [offlinePending.event_key]),1);
    assert.equal(offlineEnv.DEMOS_PRIVACY_RECOVERY_MAINTENANCE,'true',
      'the public ingress must remain blocked during offline delivery');

    console.log('GDPR_TRANSACTIONAL_OUTBOX_PG17_PASS '+JSON.stringify({
      synthetic:true,transactionRollbackAtomic:true,
      historicalBackfillIdempotent:true,oneStatementAutocommit:true,
      networkFailureRetry:true,postPutFailureRetry:true,failedDatabaseAckRetry:true,
      concurrentSkipLocked:true,noMissingEvents:true,
      missingOutboxFailsClosed:true,missingHistoricalRowsDetected:true,
      orphanedOutboxRejectedBySummaryAndReadiness:true,
      missingLedgerFailsWithoutDDL:true,
      externalReceiptReadbackRequired:true,remoteTamperRejected:true,
      microsecondExportCursorPg17:true,
      recoveryMaintenanceWorkerAbortPg17:true,
      isolatedOfflineRecoveryExporterPg17:true,
      offlineExporterRejectsConcurrentWriterPg17:true,
      readinessAndOfflineExporterSchemaShadowPg17:true,
      ordinaryWorkerAndStatusSchemaShadowPg17:true,
      ledgerWriterBootstrapAndImportSchemaShadowPg17:true,
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
