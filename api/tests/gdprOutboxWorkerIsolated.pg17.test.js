'use strict';
// Disposable GitHub Actions PostgreSQL 17 ONLY. No provider access.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { normalizeEvent, keyFor } = require('../services/privacyErasureB2Journal');
const { PrivacyErasureOutboxWorker } = require('../services/privacyErasureOutboxWorker');

const DATABASE_URL =
  'postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const USER = '00000000-0000-4000-8000-000000000301';
const OTHER = '00000000-0000-4000-8000-000000000302';
const WORKER_ROLE = 'gdpr_delivery_ci_worker';
const event = (n) => ({
  userId: USER, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
  details: { fixture: 'worker-retry-synthetic', sequence: n }
});
const enabled = () => ({
  GDPR_ERASURE_OUTBOX_ENABLED: 'true',
  GDPR_ERASURE_OUTBOX_WORKER_ENABLED: 'true',
  GDPR_LEDGER_B2_ENABLED: 'true',
  DEMOS_PRIVACY_RECOVERY_MAINTENANCE: 'false'
});
function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.GDPR_OUTBOX_WORKER_CI !== 'isolated' ||
      e.TEST_DATABASE_URL !== DATABASE_URL ||
      e.DATABASE_URL || e.SUPABASE_URL || e.SUPABASE_DB_URL ||
      e.SUPABASE_SERVICE_ROLE_KEY || e.RENDER || e.RENDER_SERVICE_ID) {
    throw Error('GDPR_B2_WORKER_CI_REFUSES_NONLOCAL_DATABASE');
  }
}
class FakeB2 {
  constructor() {
    this.objects = new Map();
    this.calls = 0;
    this.failAfterPut = false;
    this.returnBadHash = false;
    this.returnBadKey = false;
    this.onReceipt = null;
  }
  config() { return { mode: 'synthetic-no-network' }; }
  async archiveEvent(row) {
    this.calls++;
    const normalized = normalizeEvent(row);
    const key = keyFor(normalized);
    const sha256 = crypto.createHash('sha256')
      .update(JSON.stringify(normalized)).digest('hex');
    const existing = this.objects.get(key);
    if (existing && existing.sha256 !== sha256) {
      throw Error('synthetic immutable object conflict');
    }
    const receipt = existing || {
      eventKey: normalized.event_key,
      key, sha256, versionId: 'synthetic-version-' + (this.objects.size + 1),
      retentionUntil: new Date(Date.now() + 86400000).toISOString()
    };
    this.objects.set(key, receipt);
    if (this.failAfterPut) {
      this.failAfterPut = false;
      throw Error('synthetic network timeout after B2 PUT');
    }
    if (typeof this.onReceipt === 'function') await this.onReceipt();
    return {
      ...receipt,
      key: this.returnBadKey ? key + '-tampered' : key,
      sha256: this.returnBadHash ? '0'.repeat(64) : sha256,
      reused: Boolean(existing)
    };
  }
}
async function counts(pool) {
  const r = await pool.query(`
    SELECT (SELECT COUNT(*)::int FROM public.privacy_erasure_ledger) AS ledger,
           (SELECT COUNT(*)::int FROM public.privacy_erasure_delivery_outbox) AS outbox,
           (SELECT COUNT(*)::int FROM public.privacy_erasure_delivery_outbox
             WHERE delivered_at IS NULL) AS pending,
           (SELECT COUNT(*)::int FROM public.privacy_erasure_delivery_outbox
             WHERE delivered_at IS NOT NULL) AS delivered
  `);
  return r.rows[0];
}

test('worker disabled/misconfigured/recovery maintenance fails before DB and B2', async () => {
  const fake = new FakeB2();
  let connects = 0;
  const forbidden = { async connect() { connects++; throw Error('unexpected DB connection'); } };
  const config = enabled();
  const worker = new PrivacyErasureOutboxWorker({ env: config, exporter: fake });
  config.GDPR_ERASURE_OUTBOX_WORKER_ENABLED = 'false';
  await assert.rejects(worker.runOnce(forbidden), /disabled/);
  config.GDPR_ERASURE_OUTBOX_WORKER_ENABLED = 'true';
  config.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'TRUE';
  await assert.rejects(worker.runOnce(forbidden), /recovery maintenance/);
  config.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'false';
  await assert.rejects(worker.runOnce(forbidden, { limit: 21 }), /bounded batch/);
  assert.equal(connects, 0);
  assert.equal(fake.calls, 0);
});

test('operator status obtains all four counters from one SQL snapshot', async () => {
  const seen = [];
  const client = {
    async query(sql) {
      seen.push(sql);
      if (sql.includes("to_regclass('public.privacy_erasure_ledger')")) {
        return { rows: [{ledger: true, outbox: true}] };
      }
      if (sql.includes("WHERE c.oid = 'public.privacy_erasure_ledger'::regclass")) {
        return {rows:[{rls_enabled:true,force_rls:true,public_grants_exist:false,
          public_column_grants_exist:false,api_roles_with_dml_grants:0}]};
      }
      if (sql.includes("WHERE c.oid = 'public.privacy_erasure_delivery_outbox'::regclass")) {
        return {rows:[{rls_enabled:true,force_rls:true,public_grants_exist:false,
          public_column_grants_exist:false,api_roles_with_dml_grants:0}]};
      }
      if (sql.includes('AS complete_visibility')) {
        return { rows: [{complete_visibility: true}] };
      }
      if (sql.includes('FULL JOIN public.privacy_erasure_delivery_outbox')) {
        // A newly committed queued event can appear in the snapshot; a
        // READY answer must not mix older pending counts with newer rows.
        return { rows: [{pending: 1, invalid_receipts: 0,
          oldest_pending_at: null, unqueued: 0, orphaned: 0}] };
      }
      throw Error('Unexpected extra status query');
    }
  };
  const result = await PrivacyErasureOutboxWorker.status(client);
  assert.equal(result.ready, false);
  assert.equal(result.pending, 1);
  assert.equal(result.unqueued, 0);
  assert.equal(result.completeVisibility, true);
  assert.equal(seen.length, 5, 'secure schema preflight, role check and joined snapshot');
  assert.ok(seen[4].includes('FULL JOIN public.privacy_erasure_delivery_outbox'));
});

test('PG17 mock B2 archive, least-privilege worker, retry, ack, quarantine and drift checks', async () => {
  guard();
  const prior = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
  process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
  const admin = new Pool({ connectionString: DATABASE_URL, ssl: false, max: 3 });
  let workerPool;
  try {
    const identity = (await admin.query(`
      SELECT current_database() AS db,
        current_setting('server_version_num')::int AS version
    `)).rows[0];
    assert.equal(identity.db, 'gdpr_outbox_worker_ci');
    assert.equal(Math.floor(identity.version / 10000), 17);
    await Ledger.ensureTable(admin);
    await Ledger.ensureDeliveryOutbox(admin);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await admin.query('CREATE ROLE ' + role + ' NOLOGIN');
    }
    await admin.query(`CREATE ROLE ${WORKER_ROLE}
      LOGIN PASSWORD 'synthetic-worker-only' NOBYPASSRLS NOSUPERUSER`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${WORKER_ROLE}`);
    await admin.query(`GRANT SELECT ON public.privacy_erasure_ledger TO ${WORKER_ROLE}`);
    await admin.query(`GRANT SELECT, UPDATE(delivered_at,b2_version_id,b2_sha256)
      ON public.privacy_erasure_delivery_outbox TO ${WORKER_ROLE}`);
    await admin.query(`CREATE POLICY ci_worker_ledger_select
      ON public.privacy_erasure_ledger FOR SELECT TO ${WORKER_ROLE}
      USING (subject_user_id='${USER}')`);
    await admin.query(`CREATE POLICY ci_worker_outbox_select
      ON public.privacy_erasure_delivery_outbox FOR SELECT TO ${WORKER_ROLE}
      USING (true)`);
    await admin.query(`CREATE POLICY ci_worker_outbox_update
      ON public.privacy_erasure_delivery_outbox FOR UPDATE TO ${WORKER_ROLE}
      USING (true) WITH CHECK (true)`);
    workerPool = new Pool({
      host: '127.0.0.1', port: 5432, database: 'gdpr_outbox_worker_ci',
      user: WORKER_ROLE, password: 'synthetic-worker-only', ssl: false, max: 3
    });
    const role = (await workerPool.query(`
      SELECT current_user AS role_name,
        (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user)
          AS bypass
    `)).rows[0];
    assert.deepEqual(role, { role_name: WORKER_ROLE, bypass: false });

    const config = enabled();
    const fake = new FakeB2();
    const worker = new PrivacyErasureOutboxWorker({ env: config, exporter: fake });

    // A restored old snapshot with an EMPTY ledger/outbox looks drained locally,
    // even if the destroyed database had later acknowledged an erasure.
    // Never misclassify SQL-local readiness as recoverability after DB loss.
    const emptySnapshot = await PrivacyErasureOutboxWorker.status(admin);
    assert.equal(emptySnapshot.ready, true, 'local queue is empty');
    assert.equal(emptySnapshot.recoveryReady, false,
      'an empty local queue cannot attest independently durable recovery history');

    const first = await Ledger.recordEvent(admin, event(1));
    assert.equal(first.subject_user_id, USER);
    assert.deepEqual(await counts(admin), {ledger:1,outbox:1,pending:1,delivered:0});
    // Never use owner/admin even when its query privileges are sufficient.
    await assert.rejects(worker.runOnce(admin),
      /GDPR_OUTBOX_WORKER_UNSAFE_SQL_ROLE/);
    assert.equal(fake.calls, 0);
    assert.deepEqual(await counts(admin), {ledger:1,outbox:1,pending:1,delivered:0});

    let done = await worker.runOnce(workerPool);
    assert.deepEqual(done, {delivered:1,moreMayRemain:null});
    assert.deepEqual(await counts(admin), {ledger:1,outbox:1,pending:0,delivered:1});
    assert.equal(fake.calls, 1);
    done = await worker.runOnce(workerPool);
    assert.equal(done.delivered, 0);
    assert.equal(fake.calls, 1);
    const ready = await PrivacyErasureOutboxWorker.status(admin);
    assert.equal(ready.ready, true);
    assert.equal(ready.recoveryReady, false, 'delivery alone cannot attest external completeness');
    assert.equal(ready.completeVisibility, true);
    assert.equal(ready.unqueued, 0);

    // The local status must not report READY for a delivered row whose
    // B2 receipt contains an empty, whitespace-only or oversized version ID.
    // Schema CHECK rejects NULL only, so simulate malformed rows explicitly.
    const receipt=(await admin.query(
      'SELECT event_key,b2_version_id FROM public.privacy_erasure_delivery_outbox ' +
      'WHERE delivered_at IS NOT NULL ORDER BY queued_at LIMIT 1'
    )).rows[0];
    assert.ok(receipt?.event_key && receipt?.b2_version_id);
    for (const invalidId of ['', '   ', 'v'.repeat(257)]) {
      await admin.query(
        'UPDATE public.privacy_erasure_delivery_outbox ' +
        'SET b2_version_id=$1 WHERE event_key=$2',
        [invalidId,receipt.event_key]
      );
      const damaged=await PrivacyErasureOutboxWorker.status(admin);
      assert.equal(damaged.pending,0);
      assert.equal(damaged.unqueued,0);
      assert.equal(damaged.invalidReceipts,1);
      assert.equal(damaged.ready,false,
        'missing or malformed B2 version ID cannot qualify as local ready');
    }
    await admin.query(
      'UPDATE public.privacy_erasure_delivery_outbox ' +
      'SET b2_version_id=$1 WHERE event_key=$2',
      [receipt.b2_version_id,receipt.event_key]
    );
    assert.equal((await PrivacyErasureOutboxWorker.status(admin)).ready,true,
      'restoring the synthetic receipt recovers local-only readiness');

    // Reproduce the false-positive readiness after a damaged restore:
    // privileged SQL can still read every row despite disabled RLS or
    // accidental API grants. The operator check must reject that state.
    await admin.query('ALTER TABLE public.privacy_erasure_delivery_outbox DISABLE ROW LEVEL SECURITY');
    await assert.rejects(PrivacyErasureOutboxWorker.status(admin),
      /GDPR_OUTBOX_SCHEMA_NOT_PROTECTED/);
    await admin.query('ALTER TABLE public.privacy_erasure_delivery_outbox ENABLE ROW LEVEL SECURITY');
    await admin.query('GRANT SELECT ON public.privacy_erasure_delivery_outbox TO anon');
    await assert.rejects(PrivacyErasureOutboxWorker.status(admin),
      /GDPR_OUTBOX_SCHEMA_NOT_PROTECTED/);
    await admin.query('REVOKE SELECT ON public.privacy_erasure_delivery_outbox FROM anon');
    await admin.query('ALTER TABLE public.privacy_erasure_ledger DISABLE ROW LEVEL SECURITY');
    await assert.rejects(PrivacyErasureOutboxWorker.status(admin),
      /GDPR_LEDGER_SCHEMA_NOT_PROTECTED/);
    await admin.query('ALTER TABLE public.privacy_erasure_ledger ENABLE ROW LEVEL SECURITY');
    assert.equal((await PrivacyErasureOutboxWorker.status(admin)).ready, true,
      'catalog protections restored and queue still complete');

    // A worker restricted by subject-level RLS cannot certify COMPLETE
    // outbox health, even when all rows currently visible to it are delivered.
    const partial = await PrivacyErasureOutboxWorker.status(workerPool);
    assert.equal(partial.installed, true);
    assert.equal(partial.ready, false);
    assert.equal(partial.recoveryReady, false);
    assert.equal(partial.completeVisibility, false);
    assert.equal(partial.pending, null, 'do not show RLS-filtered counts as global');
    assert.equal(partial.unqueued, null);

    // Network dies AFTER an immutable remote version was written:
    // SQL ACK must stay pending, and later retry reuses the same version.
    await Ledger.recordEvent(admin, event(2));
    fake.failAfterPut = true;
    await assert.rejects(worker.runOnce(workerPool),
      /synthetic network timeout/);
    assert.deepEqual(await counts(admin), {ledger:2,outbox:2,pending:1,delivered:1});
    const versionsBeforeRetry = fake.objects.size;
    done = await worker.runOnce(workerPool);
    assert.equal(done.delivered, 1);
    assert.equal(fake.objects.size, versionsBeforeRetry);
    assert.deepEqual(await counts(admin), {ledger:2,outbox:2,pending:0,delivered:2});

    // Syntactically valid but incorrect hash or key must NEVER acknowledge.
    await Ledger.recordEvent(admin, event(3));
    fake.returnBadHash = true;
    await assert.rejects(worker.runOnce(workerPool), /Unverifiable B2 archive receipt/);
    assert.deepEqual(await counts(admin), {ledger:3,outbox:3,pending:1,delivered:2});
    fake.returnBadHash = false;
    fake.returnBadKey = true;
    await assert.rejects(worker.runOnce(workerPool), /Unverifiable B2 archive receipt/);
    assert.deepEqual(await counts(admin), {ledger:3,outbox:3,pending:1,delivered:2});
    fake.returnBadKey = false;
    done = await worker.runOnce(workerPool);
    assert.equal(done.delivered, 1);
    assert.deepEqual(await counts(admin), {ledger:3,outbox:3,pending:0,delivered:3});

    // Recover switch arrives between B2 readback and SQL ACK: leave pending.
    await Ledger.recordEvent(admin, event(4));
    fake.onReceipt = () => { config.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'true'; };
    await assert.rejects(worker.runOnce(workerPool), /recovery maintenance/);
    assert.deepEqual(await counts(admin), {ledger:4,outbox:4,pending:1,delivered:3});
    const beforeDisabled = fake.calls;
    await assert.rejects(worker.runOnce(workerPool), /recovery maintenance/);
    assert.equal(fake.calls, beforeDisabled);
    fake.onReceipt = null;
    config.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'false';
    done = await worker.runOnce(workerPool);
    assert.equal(done.delivered, 1);
    assert.deepEqual(await counts(admin), {ledger:4,outbox:4,pending:0,delivered:4});

    // A missing worker UPDATE privilege must not cause a false receipt.
    await Ledger.recordEvent(admin, event(5));
    await admin.query(`REVOKE UPDATE(delivered_at,b2_version_id,b2_sha256)
      ON public.privacy_erasure_delivery_outbox FROM ${WORKER_ROLE}`);
    await assert.rejects(worker.runOnce(workerPool),
      error => error.code === '42501');
    assert.deepEqual(await counts(admin), {ledger:5,outbox:5,pending:1,delivered:4});
    await admin.query(`GRANT UPDATE(delivered_at,b2_version_id,b2_sha256)
      ON public.privacy_erasure_delivery_outbox TO ${WORKER_ROLE}`);
    done = await worker.runOnce(workerPool);
    assert.equal(done.delivered, 1);
    assert.deepEqual(await counts(admin), {ledger:5,outbox:5,pending:0,delivered:5});

    // Two independently acquired PostgreSQL clients must not deliver the
    // same pending event concurrently. The first keeps its row locked while
    // the fake B2 call is paused; the second must SKIP LOCKED, not duplicate.
    await Ledger.recordEvent(admin, event(6));
    let unblockB2, announceB2;
    const blockedB2 = new Promise(resolve => { unblockB2 = resolve; });
    const enteredB2 = new Promise(resolve => { announceB2 = resolve; });
    let waiting = true;
    fake.onReceipt = async () => {
      if (waiting) {
        waiting = false;
        announceB2();
        await blockedB2;
      }
    };
    const activeDelivery = worker.runOnce(workerPool);
    await enteredB2;
    try {
      const competingDelivery = await worker.runOnce(workerPool);
      assert.equal(competingDelivery.delivered, 0);
      assert.equal(competingDelivery.moreMayRemain, null,
        'SKIP LOCKED empty result cannot certify queue drained');
    } finally {
      unblockB2();
    }
    const singleDelivery = await activeDelivery;
    assert.equal(singleDelivery.delivered, 1);
    fake.onReceipt = null;
    assert.deepEqual(await counts(admin), {ledger:6,outbox:6,pending:0,delivered:6});

    // Never interpret an empty pending queue as an independently complete history.
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'false';
    await Ledger.recordEvent(admin, event(7));
    const incomplete = await PrivacyErasureOutboxWorker.status(admin);
    assert.equal(incomplete.ready, false);
    assert.equal(incomplete.unqueued, 1);
    assert.equal(incomplete.pending, 0);
    assert.equal((await counts(admin)).ledger, 7);
    assert.equal((await counts(admin)).outbox, 6);
    const otherVisibility = (await workerPool.query(
      'SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger WHERE subject_user_id=$1',
      [OTHER]
    )).rows[0].n;
    assert.equal(otherVisibility, 0);

    // A real pending row can be invisible to this worker because the
    // ledger's SELECT RLS policy is subject-scoped. Zero delivered must
    // NEVER be reported as a proof that no pending work remains.
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
    await Ledger.recordEvent(admin, {
      ...event(8), userId: OTHER
    });
    const pendingBeforeHidden = (await counts(admin)).pending;
    assert.equal(pendingBeforeHidden, 1);
    const callsBeforeHidden = fake.calls;
    const hiddenBatch = await worker.runOnce(workerPool);
    assert.deepEqual(hiddenBatch, {delivered:0,moreMayRemain:null});
    assert.equal(fake.calls, callsBeforeHidden);
    assert.equal((await counts(admin)).pending, 1,
      'hidden event must remain pending for authorized remediation');
    assert.equal((await PrivacyErasureOutboxWorker.status(admin)).ready, false);

    console.log('GDPR_B2_WORKER_PG17_SYNTHETIC_PASS ' + JSON.stringify({
      noProviderIO: true, exactReceiptBinding: true,
      workerRoleNoBypass: true, adminRejected: true,
      retryAfterRemoteWrite: true, immutableVersionReused: true,
      maintenanceMidArchiveRollback: true, invalidReceiptRejected: true,
      deniedAckLeavesPending: true, concurrentWorkersSkipLocked: true,
      unqueuedHistoryNotReady: true,
      rlsHiddenPendingCannotReportDrained: true,
      skipLockedCannotReportDrained: true,
      productionUntouched: true
    }));
  } finally {
    if (prior === undefined) delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    else process.env.GDPR_ERASURE_OUTBOX_ENABLED = prior;
    if (workerPool) await workerPool.end();
    await admin.end();
  }
});
