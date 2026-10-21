'use strict';

// This suite is deliberately incapable of connecting to production databases.
// It runs ONLY against the disposable 127.0.0.1:5432/demos_outbox_ci
// PostgreSQL service provisioned by GitHub Actions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createAuditOutbox } = require('../services/auditOutboxService');

function checkedTestUrl(value) {
  if (!value) return null;
  const parsed = new URL(value);
  if (parsed.protocol !== 'postgres:' || parsed.hostname !== '127.0.0.1' ||
      parsed.port !== '5432' || parsed.pathname !== '/demos_outbox_ci') {
    throw new Error('REFUSING_NON_EPHEMERAL_TEST_DATABASE');
  }
  return value;
}

const testUrl = checkedTestUrl(process.env.DEMOS_OUTBOX_POSTGRES_TEST_URL);
if (process.env.GITHUB_ACTIONS === 'true' && !testUrl) {
  throw new Error('GITHUB_CI_REAL_POSTGRES_URL_REQUIRED');
}
const synthetic = Object.freeze({
  _time: '2026-10-21T12:00:00.000Z',
  log_type: 'audit',
  action: 'SYNTHETIC_EVENT',
  resource: 'ci-only',
  success: true
});

test('real PostgreSQL: private grants, concurrent leases, recovery, and retry', {
  skip: !testUrl && 'Requires disposable local PostgreSQL service'
}, async (t) => {
  const pool = new Pool({ connectionString: testUrl, max: 8, connectionTimeoutMillis: 5000 });
  const report = [];
  const make = (send, options = {}) => createAuditOutbox({
    pool, send, random: () => 0.5,
    report: (code, info) => report.push({ code, info }),
    ...options
  });

  async function clean() {
    await pool.query('TRUNCATE TABLE demos_private.audit_delivery_outbox');
  }

  try {
    await pool.query('CREATE ROLE anon NOLOGIN');
    await pool.query('CREATE ROLE authenticated NOLOGIN');
    const doc = fs.readFileSync(path.join(__dirname, '../../docs/operations/AUDIT_OUTBOX_DESIGN_2026-10-21.md'), 'utf8');
    const match = doc.match(/```sql\r?\n([\s\S]*?)\r?\n```/);
    assert.ok(match, 'proposed schema should be embedded in the runbook');
    await pool.query(match[1]);

    await t.test('anon/authenticated cannot use schema or table, RLS is enabled', async () => {
      const meta = await pool.query(`SELECT
        has_schema_privilege('anon','demos_private','USAGE') AS anon_schema,
        has_schema_privilege('authenticated','demos_private','USAGE') AS auth_schema,
        has_table_privilege('anon','demos_private.audit_delivery_outbox','SELECT') AS anon_select,
        has_table_privilege('authenticated','demos_private.audit_delivery_outbox','INSERT') AS auth_insert,
        (SELECT relrowsecurity FROM pg_class WHERE oid='demos_private.audit_delivery_outbox'::regclass) AS rls`);
      assert.deepEqual(Object.values(meta.rows[0]), [false, false, false, false, true]);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE anon');
        await assert.rejects(() => client.query('SELECT count(*) FROM demos_private.audit_delivery_outbox'), err => err.code === '42501');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    await t.test('FOR UPDATE SKIP LOCKED does not wait on row locked by another connection', async () => {
      await clean();
      const send = async () => true;
      const worker = make(send);
      const id = await worker.enqueue(synthetic, 'real-time');
      const locker = await pool.connect();
      try {
        await locker.query('BEGIN');
        await locker.query('SELECT id FROM demos_private.audit_delivery_outbox WHERE id=$1 FOR UPDATE', [id]);
        const skipped = await worker.drainOnce({ limit: 1 });
        assert.equal(skipped.claimed, 0);
        await locker.query('COMMIT');
        const delivered = await worker.drainOnce({ limit: 1 });
        assert.equal(delivered.delivered, 1);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM demos_private.audit_delivery_outbox')).rows[0].n, 0);
      } finally {
        await locker.query('ROLLBACK').catch(() => {});
        locker.release();
      }
    });

    await t.test('simultaneous workers do not claim same unexpired lease', async () => {
      await clean();
      let release;
      let entered;
      const sent = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      let deliveries = 0;
      const first = make(async () => {
        deliveries++;
        entered();
        await gate;
        return true;
      });
      const second = make(async () => {
        deliveries++;
        return true;
      });
      await first.enqueue(synthetic, 'real-time');
      const inFlight = first.drainOnce({ limit: 1 });
      await sent;
      const competitor = await second.drainOnce({ limit: 1 });
      assert.equal(competitor.claimed, 0);
      release();
      assert.equal((await inFlight).delivered, 1);
      assert.equal(deliveries, 1);
    });

    await t.test('expired lease after simulated crash recovers; late acknowledgement is rejected', async () => {
      await clean();
      report.length = 0;
      let release;
      let entered;
      const started = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      const seen = [];
      const first = make(async (_dataset, payload) => {
        seen.push(payload.axiom_delivery_id);
        entered();
        await gate;
        return true;
      });
      const second = make(async (_dataset, payload) => {
        seen.push(payload.axiom_delivery_id);
        return true;
      });
      const id = await first.enqueue(synthetic, 'real-time');
      const outstanding = first.drainOnce({ limit: 1 });
      await started;
      // Simulate a dead worker's lease expiration, no real sleeping required.
      await pool.query("UPDATE demos_private.audit_delivery_outbox SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [id]);
      const recovery = await second.drainOnce({ limit: 1 });
      assert.equal(recovery.delivered, 1);
      release();
      assert.equal((await outstanding).delivered, 0);
      assert.deepEqual(seen, [id, id], 'deduplication ID must be stable across retries');
      assert.equal(report.filter(x => x.code === 'AUDIT_OUTBOX_ACK_STALE').length, 1);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM demos_private.audit_delivery_outbox')).rows[0].n, 0);
    });

    await t.test('transactional advisory lock enforces capacity with two concurrent INSERTs', async () => {
      await clean();
      report.length = 0;
      const writerA = make(async () => true, { maxRecords: 1 });
      const writerB = make(async () => true, { maxRecords: 1 });
      const outcomes = await Promise.allSettled([
        writerA.enqueue(synthetic, 'real-time'),
        writerB.enqueue(synthetic, 'real-time')
      ]);
      assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter(x =>
        x.status === 'rejected' && x.reason.message === 'OUTBOX_CAPACITY_EXCEEDED'
      ).length, 1);
      const tally = await pool.query('SELECT COUNT(*)::integer AS n FROM demos_private.audit_delivery_outbox');
      assert.equal(tally.rows[0].n, 1);
      const health = await writerA.getHealth();
      assert.equal(health.total, 1);
      assert.equal(health.capacity, 1);

      // Dead letters consume capacity too: never auto-delete for free space.
      await pool.query("UPDATE demos_private.audit_delivery_outbox SET status='dead_letter'");
      await assert.rejects(
        () => writerA.enqueue(synthetic, 'real-time'),
        /OUTBOX_CAPACITY_EXCEEDED/
      );
      assert.equal((await writerA.getHealth()).deadLetter, 1);
    });

    await t.test('failure retains event until retry; dead-letter does not get retried', async () => {
      await clean();
      const failing = make(async () => false);
      const id = await failing.enqueue(synthetic, 'real-time');
      const first = await failing.drainOnce({ limit: 1 });
      assert.equal(first.rescheduled, 1);
      const pending = await pool.query('SELECT attempt_count, status FROM demos_private.audit_delivery_outbox WHERE id=$1', [id]);
      assert.equal(pending.rows[0].attempt_count, 1);
      assert.equal(pending.rows[0].status, 'pending');
      await pool.query('UPDATE demos_private.audit_delivery_outbox SET attempt_count=7, next_attempt_at=NOW()-INTERVAL \'1 second\' WHERE id=$1', [id]);
      assert.equal((await failing.drainOnce({ limit: 1 })).deadLettered, 1);
      const dead = await pool.query('SELECT status FROM demos_private.audit_delivery_outbox WHERE id=$1', [id]);
      assert.equal(dead.rows[0].status, 'dead_letter');
      assert.equal((await failing.drainOnce({ limit: 1 })).claimed, 0);
    });
  } finally {
    await pool.end();
  }
});

test('real PostgreSQL test refuses a URL that could target production', () => {
  assert.throws(
    () => checkedTestUrl('postgres://postgres:secret@db.production.supabase.co:5432/postgres'),
    /REFUSING_NON_EPHEMERAL_TEST_DATABASE/
  );
});
