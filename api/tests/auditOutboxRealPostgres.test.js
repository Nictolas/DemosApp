'use strict';

// This suite is deliberately incapable of connecting to production databases.
// It runs ONLY against the disposable 127.0.0.1:5432/demos_outbox_ci
// PostgreSQL service provisioned by GitHub Actions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const Module = require('node:module');
const { createAuditOutbox } = require('../services/auditOutboxService');
const { createAuditOutboxDatabase } = require('../services/auditOutboxDatabase');

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
    const blocks = [...doc.matchAll(/```sql\r?\n([\s\S]*?)\r?\n```/g)];
    assert.ok(blocks.length >= 2, 'both initial schema and role migrations must be documented');
    await pool.query(blocks[0][1]);
    await pool.query(blocks[1][1]);

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

    await t.test('restricted NOLOGIN worker exercises INSERT/UPDATE/DELETE under RLS', async () => {
      const status = await pool.query(`SELECT
        rolcanlogin, rolbypassrls, rolsuper,
        has_schema_privilege('demos_outbox_worker','demos_private','USAGE') AS schema_access,
        has_table_privilege('demos_outbox_worker','demos_private.audit_delivery_outbox','INSERT') AS insert_access,
        has_table_privilege('demos_outbox_worker','demos_private.audit_delivery_outbox','DELETE') AS delete_access,
        has_schema_privilege('demos_outbox_worker','public','CREATE') AS public_create
      FROM pg_roles WHERE rolname='demos_outbox_worker'`);
      assert.equal(status.rows.length, 1);
      assert.deepEqual(Object.values(status.rows[0]), [
        false, false, false, true, true, true, false
      ]);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE demos_outbox_worker');
        const who = await client.query('SELECT current_user AS role');
        assert.equal(who.rows[0].role, 'demos_outbox_worker');
        const id = 'b60dfd3c-f984-4dfa-8b9b-cbce52e56bb2';
        await client.query(`INSERT INTO demos_private.audit_delivery_outbox
           (id,dataset,category,payload)
           VALUES ($1,'real-time','audit',$2::jsonb)`,
        [id, JSON.stringify({ log_type: 'audit', action: 'SYNTHETIC_CI_ONLY' })]);
        const edit = await client.query(`UPDATE demos_private.audit_delivery_outbox
           SET attempt_count=attempt_count+1 WHERE id=$1 RETURNING attempt_count`, [id]);
        assert.equal(edit.rows[0].attempt_count, 1);
        const deleted = await client.query(
          'DELETE FROM demos_private.audit_delivery_outbox WHERE id=$1 RETURNING id', [id]);
        assert.equal(deleted.rows.length, 1);
        await client.query('ROLLBACK');
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    });

    await t.test('a separate login inherits only outbox grants and runs the complete queue', async () => {
      await clean();
      await pool.query(`CREATE ROLE demos_outbox_runtime_ci
        LOGIN PASSWORD 'ci-only-outbox' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
      await pool.query('GRANT demos_outbox_worker TO demos_outbox_runtime_ci');

      const restricted = createAuditOutboxDatabase({
        env: {
          DATABASE_URL: testUrl,
          NODE_ENV: 'test',
          AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'ci-only',
          AUDIT_OUTBOX_DATABASE_URL:
            'postgresql://demos_outbox_runtime_ci:ci-only-outbox@127.0.0.1:5432/demos_outbox_ci'
        }
      });
      try {
        await restricted.ensureReady();
        const current = await restricted.pool.query(
          'SELECT current_user AS role, current_database() AS db'
        );
        assert.equal(current.rows[0].role, 'demos_outbox_runtime_ci');
        assert.equal(current.rows[0].db, 'demos_outbox_ci');
        let transmitted = 0;
        const outbox = createAuditOutbox({
          pool: restricted.pool, ensureReady: restricted.ensureReady,
          send: async () => { transmitted++; return true; }
        });
        const eventId = await outbox.enqueue(synthetic, 'real-time');
        assert.match(eventId, /^[a-f0-9-]{36}$/);
        assert.equal((await outbox.getHealth()).total, 1);
        const sent = await outbox.drainOnce({ limit: 1 });
        assert.equal(sent.delivered, 1);
        assert.equal(transmitted, 1);
        assert.equal((await outbox.getHealth()).total, 0);
      } finally {
        await restricted.pool.end();
      }
    });

    await t.test('real PostgreSQL retention snapshot classifies synthetic aged backlog and rolls back', async () => {
      // Unlike mocked unit tests, exercise the exact SNAPSHOT_SQL against
      // disposable PostgreSQL 17 with a restricted login. Never staging/prod.
      await clean();
      const { readRetentionSnapshot } = require('../services/auditOutboxRetentionSnapshot');
      const restricted = createAuditOutboxDatabase({
        env: {
          DATABASE_URL: testUrl,
          NODE_ENV: 'test',
          AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'ci-only',
          AUDIT_OUTBOX_DATABASE_URL:
            'postgresql://demos_outbox_runtime_ci:ci-only-outbox@127.0.0.1:5432/demos_outbox_ci'
        }
      });
      let client;
      try {
        await restricted.ensureReady();
        client = await restricted.pool.connect();
        await client.query('BEGIN');
        await client.query(`
          INSERT INTO demos_private.audit_delivery_outbox
            (id, dataset, category, payload, status, created_at)
          SELECT gen_random_uuid(), 'real-time', 'audit',
            '{"synthetic":true,"action":"CI_RETENTION_ONLY"}'::jsonb,
            ages.status, NOW() - ages.age
          FROM (VALUES
            ('pending', INTERVAL '1 minute'),
            ('pending', INTERVAL '16 minutes'),
            ('pending', INTERVAL '25 hours'),
            ('sending', INTERVAL '2 hours'),
            ('dead_letter', INTERVAL '4 days'),
            ('dead_letter', INTERVAL '31 days')
          ) AS ages(status, age)
        `);
        const result = await readRetentionSnapshot({
          pool: client,
          ensureReady: restricted.ensureReady,
          env: {
            AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'staging',
            AUDIT_OUTBOX_PREFLIGHT_ONLY: 'true',
            AUDIT_OUTBOX_ENABLED: 'false',
            AUDIT_OUTBOX_WORKER_ENABLED: 'false',
            AUDIT_OUTBOX_SECURITY_ENABLED: 'false',
            AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED: 'false',
            AXIOM_ARCHIVE_ENABLED: 'false'
          }
        });
        assert.deepEqual({
          total: result.total, pending: result.pending, sending: result.sending,
          dead_letter: result.dead_letter, pending_over_15m: result.pending_over_15m,
          pending_over_24h: result.pending_over_24h,
          dead_letter_over_72h: result.dead_letter_over_72h,
          dead_letter_over_30d: result.dead_letter_over_30d,
          needsReview: result.needsReview
        }, {
          total: 6, pending: 3, sending: 1, dead_letter: 2,
          pending_over_15m: 2, pending_over_24h: 1,
          dead_letter_over_72h: 2, dead_letter_over_30d: 1,
          needsReview: true
        });
        assert.ok(result.oldest_age_seconds >= 30 * 24 * 60 * 60);
        // A rollback preserves all pre-existing state and leaves no fixture.
        await client.query('ROLLBACK');
        const after = await restricted.pool.query(
          'SELECT COUNT(*)::integer AS n FROM demos_private.audit_delivery_outbox'
        );
        assert.equal(after.rows[0].n, 0);
      } finally {
        await client?.query('ROLLBACK').catch(() => {});
        client?.release();
        await restricted.pool.end();
      }
    });

    await t.test('restricted runtime rejects accidental unrelated grants and PUBLIC SECURITY DEFINER', async () => {
      const env = {
        DATABASE_URL: testUrl,
        NODE_ENV: 'test',
        AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'ci-only',
        AUDIT_OUTBOX_DATABASE_URL:
          'postgresql://demos_outbox_runtime_ci:ci-only-outbox@127.0.0.1:5432/demos_outbox_ci'
      };
      async function preflight() {
        const db = createAuditOutboxDatabase({ env });
        try { await db.ensureReady(); }
        finally { await db.pool.end(); }
      }
      const tableName = 'demos_private.demos_outbox_unrelated_canary';
      const fnName = 'demos_private.demos_outbox_definer_canary()';
      await preflight(); // starts with only the outbox grants
      try {
        await pool.query(`CREATE TABLE ${tableName} (id integer)`);
        await pool.query(`GRANT SELECT ON ${tableName} TO demos_outbox_runtime_ci`);
        await assert.rejects(preflight, /DATABASE_PREFLIGHT_FAILED/,
          'runtime must not inherit read access to unrelated tables');
        await pool.query(`REVOKE SELECT ON ${tableName} FROM demos_outbox_runtime_ci`);
        await pool.query(`DROP TABLE ${tableName}`);

        await pool.query(
          "CREATE FUNCTION demos_private.demos_outbox_definer_canary() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'"
        );
        await assert.rejects(preflight, /DATABASE_PREFLIGHT_FAILED/,
          'PUBLIC EXECUTE on a privileged function must block the worker');
        await pool.query(`REVOKE EXECUTE ON FUNCTION ${fnName} FROM PUBLIC`);
        await preflight();
      } finally {
        await pool.query(`DROP TABLE IF EXISTS ${tableName}`).catch(() => {});
        await pool.query(`DROP FUNCTION IF EXISTS ${fnName}`).catch(() => {});
      }
    });

    await t.test('real PG + simulated Axiom outage preserves delivery ID across retry', async () => {
      await clean();
      const restricted = createAuditOutboxDatabase({
        env: {
          DATABASE_URL: testUrl,
          NODE_ENV: 'test',
          AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'ci-only',
          AUDIT_OUTBOX_DATABASE_URL: 'postgresql://demos_outbox_runtime_ci:ci-only-outbox@127.0.0.1:5432/demos_outbox_ci'
        }
      });
      // The audit service must not load or contact DEMOS's main database.
      const auditPath = require.resolve('../services/auditService');
      const oldLoad = Module._load;
      let AuditService;
      try {
        Module._load = function(request, parent, isMain) {
          if (request === '../middleware/auth' && parent?.filename === auditPath) {
            return { pool: { query: () => { throw new Error('MAIN_DB_NOT_ALLOWED'); } } };
          }
          return oldLoad.call(this, request, parent, isMain);
        };
        delete require.cache[auditPath];
        AuditService = require('../services/auditService');
      } finally {
        Module._load = oldLoad;
      }
      const axios = require('axios');
      const oldPost = axios.post;
      const keys = ['AXIOM_ENABLED', 'AXIOM_API_TOKEN', 'AXIOM_ORG_ID', 'AXIOM_REGION'];
      const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
      process.env.AXIOM_ENABLED = 'true';
      process.env.AXIOM_API_TOKEN = 'ci-fake-token';
      process.env.AXIOM_ORG_ID = 'ci-fake-org';
      process.env.AXIOM_REGION = 'eu';
      const attempts = [];
      axios.post = async (url, rows) => {
        assert.match(url, /^https:\/\/eu-central-1\.aws\.edge\.axiom\.co\/v1\/ingest\/real-time$/);
        attempts.push(structuredClone(rows[0]));
        if (attempts.length === 1) {
          const err = new Error('synthetic 503');
          err.response = { status: 503 };
          throw err;
        }
        return { status: 202 };
      };
      try {
        await restricted.ensureReady();
        const outbox = createAuditOutbox({
          pool: restricted.pool, ensureReady: restricted.ensureReady,
          random: () => 0.5,
          send: (dataset, payload) =>
            AuditService.sendPreparedAuditEventToAxiomHTTP(dataset, payload)
        });
        const id = await outbox.enqueue(synthetic, 'real-time');
        assert.equal((await outbox.drainOnce({ limit: 1 })).rescheduled, 1);
        assert.equal((await outbox.getHealth()).pending, 1);
        await pool.query("UPDATE demos_private.audit_delivery_outbox SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE id=$1", [id]);
        assert.equal((await outbox.drainOnce({ limit: 1 })).delivered, 1);
        assert.equal((await outbox.getHealth()).total, 0);
        assert.equal(attempts.length, 2);
        assert.deepEqual(attempts[0], attempts[1]);
        assert.equal(attempts[0].axiom_delivery_id, id);
      } finally {
        axios.post = oldPost;
        delete require.cache[auditPath];
        for (const [k,v] of Object.entries(previous)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
        await restricted.pool.end();
      }
    });

    await t.test('restricted PG outbox -> simulated Axiom retries -> B2 archive -> read-only restore', async () => {
      await clean();
      const { AxiomArchiveService } = require('../services/axiomArchiveService');
      const restricted = createAuditOutboxDatabase({
        env: {
          DATABASE_URL: testUrl,
          NODE_ENV: 'test',
          AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'ci-only',
          AUDIT_OUTBOX_DATABASE_URL:
            'postgresql://demos_outbox_runtime_ci:ci-only-outbox@127.0.0.1:5432/demos_outbox_ci'
        }
      });
      const ingested = [];
      const b2Objects = new Map();
      let putCalls = 0;
      const b2Client = {
        async send(command) {
          const { Key, Body, Metadata, ContentEncoding, ContentType } = command.input;
          switch (command.constructor.name) {
            case 'PutObjectCommand':
              putCalls++;
              b2Objects.set(Key, {
                body: Buffer.from(Body),
                metadata: Metadata,
                contentEncoding: ContentEncoding,
                contentType: ContentType
              });
              return {};
            case 'HeadObjectCommand': {
              const saved = b2Objects.get(Key);
              assert.ok(saved, 'HEAD must reference an uploaded synthetic object');
              return { ContentLength: saved.body.length, Metadata: saved.metadata };
            }
            case 'GetObjectCommand': {
              const saved = b2Objects.get(Key);
              assert.ok(saved, 'GET must reference an uploaded synthetic object');
              assert.equal(command.input.Range, `bytes=0-${saved.body.length - 1}`);
              return {
                Body: { async *[Symbol.asyncIterator]() { yield saved.body; } },
                Metadata: saved.metadata,
                ContentEncoding: saved.contentEncoding,
                ContentType: saved.contentType
              };
            }
            default:
              throw new Error('UNEXPECTED_SYNTHETIC_B2_COMMAND');
          }
        }
      };
      try {
        await restricted.ensureReady();
        let attempts = 0;
        const outbox = createAuditOutbox({
          pool: restricted.pool,
          ensureReady: restricted.ensureReady,
          random: () => 0.5,
          send: async (dataset, payload) => {
            assert.equal(dataset, 'real-time');
            attempts++;
            // First Axiom receipt loses its HTTP acknowledgement; identical
            // delivery UUID is ingested a second time after the retry.
            ingested.push({
              ...structuredClone(payload),
              _id: `synthetic-ingest-${attempts}`,
              _sysTime: `2026-10-21T12:0${attempts}:00.000Z`
            });
            return attempts > 1;
          }
        });

        const id = await outbox.enqueue(synthetic, 'real-time');
        assert.equal((await outbox.drainOnce({ limit: 1 })).rescheduled, 1);
        await pool.query(
          "UPDATE demos_private.audit_delivery_outbox SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE id=$1",
          [id]
        );
        assert.equal((await outbox.drainOnce({ limit: 1 })).delivered, 1);
        assert.equal((await outbox.getHealth()).total, 0);
        assert.equal(ingested.length, 2);
        assert.equal(ingested[0].axiom_delivery_id, id);
        assert.equal(ingested[1].axiom_delivery_id, id);

        const archive = new AxiomArchiveService({
          env: {
            AXIOM_ARCHIVE_PREFIX: 'demos/axiom-archive/v1',
            B2_BUCKET_NAME: 'synthetic-ci-bucket',
            B2_S3_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com',
            B2_S3_REGION: 'eu-central-003',
            B2_S3_ACCESS_KEY_ID: 'synthetic-no-network',
            B2_S3_SECRET_ACCESS_KEY: 'synthetic-no-network'
          },
          axiomClient: { async query() { return { matches: ingested }; } },
          b2Client
        });
        const archived = await archive.archiveWindow({
          dataset: 'real-time',
          startTime: new Date('2026-10-21T11:55:00Z'),
          endTime: new Date('2026-10-21T12:15:00Z'),
          archivedAt: new Date('2026-10-21T12:16:00Z')
        });
        assert.equal(archived.count, 1, 'same delivery UUID must archive once');
        assert.equal(archived.categories.audit, 1);
        assert.equal(archived.objects.length, 1);
        const beforeRestore = putCalls;
        const restored = await archive.verifyLatestArchiveBatch('real-time');
        assert.equal(restored.verifiedEvents, 1);
        assert.equal(restored.categories.audit, 1);
        assert.equal(restored.verifiedObjects, 1);
        assert.equal(putCalls, beforeRestore, 'restore must not write to B2');
      } finally {
        await restricted.pool.end();
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

    await t.test('slow first HTTP send never leases the next queued event prematurely', async () => {
      await clean();
      let releaseFirst;
      let startedFirst;
      const began = new Promise(resolve => { startedFirst = resolve; });
      const gate = new Promise(resolve => { releaseFirst = resolve; });
      const seen = [];
      const first = make(async (_dataset, payload) => {
        seen.push(['slow', payload.axiom_delivery_id]);
        startedFirst();
        await gate;
        return true;
      });
      const second = make(async (_dataset, payload) => {
        seen.push(['fast', payload.axiom_delivery_id]);
        return true;
      });
      const firstId = await first.enqueue(synthetic, 'real-time');
      const secondId = await first.enqueue(synthetic, 'real-time');
      const batch = first.drainOnce({ limit: 2 });
      try {
        await began;
        const statuses = await pool.query(
          "SELECT id::text AS id, status FROM demos_private.audit_delivery_outbox ORDER BY created_at, id");
        assert.equal(statuses.rows.length, 2);
        assert.equal(statuses.rows.filter(r => r.status === 'sending').length, 1);
        assert.equal(statuses.rows.filter(r => r.status === 'pending').length, 1);
        const fast = await second.drainOnce({ limit: 1 });
        assert.equal(fast.delivered, 1, 'another worker can process the still-pending second event');
        assert.deepEqual(seen.map(s => s[1]).sort(), [firstId, secondId].sort());
      } finally {
        releaseFirst?.();
        await batch;
      }
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM demos_private.audit_delivery_outbox')).rows[0].n, 0);
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
