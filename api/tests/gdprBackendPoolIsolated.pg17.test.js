'use strict';
// Disposable PostgreSQL 17 ONLY: uses the ACTUAL backend api/config/database.js
// singleton, real SQL login roles, a FakeB2 exporter, and no HTTP service.
// This is NOT a Render deployment or a Supabase credential test.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { PrivacyErasureOutboxWorker } = require('../services/privacyErasureOutboxWorker');
const { normalizeEvent, keyFor } = require('../services/privacyErasureB2Journal');

const ADMIN_URL =
  'postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const TEST_DB = 'gdpr_runtime_pool_ci';
const WRITER = 'gdpr_runtime_ci_writer';
const WORKER = 'gdpr_runtime_ci_worker';
const SUBJECT = '00000000-0000-4000-8000-000000000301';
const OUTSIDE = '00000000-0000-4000-8000-000000000399';
const DB_MODULE = require.resolve('../config/database');

function guard() {
  const env = process.env;
  if (env.GITHUB_ACTIONS !== 'true' ||
      env.GDPR_BACKEND_POOL_CI !== 'isolated' ||
      env.TEST_DATABASE_URL !== ADMIN_URL ||
      env.DATABASE_URL || env.SUPABASE_URL || env.SUPABASE_DB_URL ||
      env.SUPABASE_SERVICE_ROLE_KEY || env.RENDER || env.RENDER_SERVICE_ID ||
      env.GDPR_LEDGER_B2_ACCESS_KEY_ID || env.GDPR_LEDGER_B2_SECRET_ACCESS_KEY) {
    throw Error('GDPR_BACKEND_POOL_CI_REFUSES_NONLOCAL_DATABASE');
  }
}

function actualBackendModuleAs(role) {
  if (![WRITER, WORKER].includes(role)) {
    throw Error('GDPR_BACKEND_POOL_CI_INVALID_SQL_ROLE');
  }
  // Synthetic host, password and database. Include sslmode=require to prove
  // the backend strips caller-supplied SSL connection-string overrides.
  process.env.DATABASE_URL =
    'postgresql://' + role + ':synthetic-ci-only@127.0.0.1:5432/' +
    TEST_DB + '?sslmode=require&pgbouncer=true';
  process.env.DATABASE_POOL_MAX = '2';
  process.env.DATABASE_POOL_MIN = '0';
  delete require.cache[DB_MODULE];
  return require('../config/database');
}

async function state(db) {
  const response = await db.query(
    'SELECT ' +
    '(SELECT COUNT(*)::int FROM public.privacy_erasure_ledger) AS ledger, ' +
    '(SELECT COUNT(*)::int FROM public.privacy_erasure_delivery_outbox) AS outbox, ' +
    '(SELECT COUNT(*)::int FROM public.privacy_erasure_delivery_outbox ' +
    ' WHERE delivered_at IS NOT NULL) AS delivered'
  );
  return response.rows[0];
}

class SyntheticImmutableArchive {
  constructor() { this.calls = 0; this.receipts = new Map(); }
  config() { return { offline: true }; }
  async archiveEvent(raw) {
    this.calls++;
    const event = normalizeEvent(raw);
    const key = keyFor(event);
    const sha256 = crypto.createHash('sha256')
      .update(JSON.stringify(event)).digest('hex');
    const previous = this.receipts.get(key);
    if (previous && previous.sha256 !== sha256) {
      throw Error('Synthetic immutable archive collision');
    }
    const receipt = previous || {
      eventKey: event.event_key, key, sha256,
      versionId: 'synthetic-backend-pool-version-1',
      retentionUntil: new Date(Date.now() + 86400000).toISOString()
    };
    this.receipts.set(key, receipt);
    return receipt;
  }
}

test('backend pool refuses a remote/inherited DB config before creating clients', () => {
  // The CI job must NOT use a provider connection or ambient database secrets.
  guard();
  assert.equal(process.env.DATABASE_URL, undefined);
});

test('actual backend pool logs in as separate NOBYPASSRLS writer/worker and ACKs mock B2', async () => {
  guard();
  const original = {};
  for (const key of [
    'DATABASE_URL', 'DATABASE_POOL_MAX', 'DATABASE_POOL_MIN',
    'GDPR_ERASURE_OUTBOX_ENABLED'
  ]) original[key] = process.env[key];

  const root = new Pool({ connectionString: ADMIN_URL, ssl: false, max: 1 });
  let admin;
  let activeBackend = null;
  try {
    const rootDb = (await root.query(
      'SELECT current_database() AS db, current_setting(' +
      "'server_version_num')::int AS version"
    )).rows[0];
    assert.equal(rootDb.db, 'gdpr_outbox_worker_ci');
    assert.equal(Math.floor(rootDb.version / 10000), 17);
    await root.query('CREATE DATABASE ' + TEST_DB);

    admin = new Pool({
      host: '127.0.0.1', port: 5432, database: TEST_DB,
      user: 'postgres', password: 'synthetic-only', ssl: false, max: 2
    });
    for (const role of ['anon', 'authenticated', 'service_role']) {
      // Roles are cluster-wide, and the preceding worker suite may already
      // have created them in its separate ephemeral PostgreSQL database.
      await admin.query(
        'DO $roles$ BEGIN IF NOT EXISTS (' +
        "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='" + role + "'" +
        ') THEN CREATE ROLE ' + role + ' NOLOGIN; END IF; END $roles$;'
      );
    }
    await Ledger.ensureTable(admin);
    await Ledger.ensureDeliveryOutbox(admin);
    for (const role of [WRITER, WORKER]) {
      await admin.query(
        "CREATE ROLE " + role +
        " LOGIN PASSWORD 'synthetic-ci-only' NOSUPERUSER NOBYPASSRLS " +
        'NOCREATEDB NOCREATEROLE NOINHERIT'
      );
      await admin.query('GRANT USAGE ON SCHEMA public TO ' + role);
    }
    await admin.query(
      'GRANT SELECT,INSERT ON public.privacy_erasure_ledger TO ' + WRITER
    );
    await admin.query(
      'GRANT SELECT,INSERT ON public.privacy_erasure_delivery_outbox TO ' + WRITER
    );
    await admin.query(
      'GRANT SELECT ON public.privacy_erasure_ledger TO ' + WORKER
    );
    await admin.query(
      'GRANT SELECT,UPDATE(delivered_at,b2_version_id,b2_sha256) ' +
      'ON public.privacy_erasure_delivery_outbox TO ' + WORKER
    );

    await admin.query(
      'CREATE POLICY backend_pool_writer_ledger_select ' +
      'ON public.privacy_erasure_ledger FOR SELECT TO ' + WRITER +
      " USING (subject_user_id='" + SUBJECT + "')"
    );
    await admin.query(
      'CREATE POLICY backend_pool_writer_ledger_insert ' +
      'ON public.privacy_erasure_ledger FOR INSERT TO ' + WRITER +
      " WITH CHECK (subject_user_id='" + SUBJECT + "')"
    );
    await admin.query(
      'CREATE POLICY backend_pool_writer_outbox_select ' +
      'ON public.privacy_erasure_delivery_outbox FOR SELECT TO ' + WRITER +
      ' USING (true)'
    );
    await admin.query(
      'CREATE POLICY backend_pool_writer_outbox_insert ' +
      'ON public.privacy_erasure_delivery_outbox FOR INSERT TO ' + WRITER +
      ' WITH CHECK (true)'
    );
    await admin.query(
      'CREATE POLICY backend_pool_worker_ledger_select ' +
      'ON public.privacy_erasure_ledger FOR SELECT TO ' + WORKER +
      " USING (subject_user_id='" + SUBJECT + "')"
    );
    await admin.query(
      'CREATE POLICY backend_pool_worker_outbox_select ' +
      'ON public.privacy_erasure_delivery_outbox FOR SELECT TO ' + WORKER +
      ' USING (true)'
    );
    await admin.query(
      'CREATE POLICY backend_pool_worker_outbox_update ' +
      'ON public.privacy_erasure_delivery_outbox FOR UPDATE TO ' + WORKER +
      ' USING (true) WITH CHECK (true)'
    );

    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
    activeBackend = actualBackendModuleAs(WRITER);
    assert.equal(activeBackend.poolConfig.ssl, false);
    assert.equal(activeBackend.poolConfig.max, 2);
    assert.equal(activeBackend.poolConfig.min, 0);
    assert.ok(activeBackend.poolConfig.connectionString.includes('pgbouncer=true'));
    assert.ok(!activeBackend.poolConfig.connectionString.includes('sslmode='));

    let pool = activeBackend.getPool();
    let who = (await pool.query(
      "SELECT current_user AS role_name, " +
      "current_database() AS db, " +
      "current_setting('application_name') AS application_name, " +
      "(SELECT rolbypassrls FROM pg_catalog.pg_roles " +
      " WHERE rolname=current_user) AS bypass_rls"
    )).rows[0];
    assert.equal(who.role_name, WRITER);
    assert.equal(who.db, TEST_DB);
    assert.equal(who.bypass_rls, false);
    assert.equal(who.application_name, 'demos-app-performance-optimized');
    const inserted = await Ledger.recordEvent(pool, {
      userId: SUBJECT,
      eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      details: { fixture: 'backend-real-pool-synthetic', revoked: true }
    });
    assert.equal(inserted.subject_user_id, SUBJECT);
    await assert.rejects(Ledger.recordEvent(pool, {
      userId: OUTSIDE,
      eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      details: {}
    }), err => err.code === '42501');
    assert.deepEqual(await state(admin), { ledger: 1, outbox: 1, delivered: 0 });

    await activeBackend.closePool();
    activeBackend = actualBackendModuleAs(WORKER);
    pool = activeBackend.getPool();
    who = (await pool.query(
      "SELECT current_user AS role_name, " +
      "current_database() AS db, " +
      "(SELECT rolbypassrls FROM pg_catalog.pg_roles " +
      " WHERE rolname=current_user) AS bypass_rls"
    )).rows[0];
    assert.equal(who.role_name, WORKER);
    assert.equal(who.db, TEST_DB);
    assert.equal(who.bypass_rls, false);

    const fake = new SyntheticImmutableArchive();
    const consumer = new PrivacyErasureOutboxWorker({
      env: {
        GDPR_ERASURE_OUTBOX_ENABLED: 'true',
        GDPR_ERASURE_OUTBOX_WORKER_ENABLED: 'true',
        DEMOS_PRIVACY_RECOVERY_MAINTENANCE: 'false'
      },
      exporter: fake
    });
    const delivery = await consumer.runOnce(pool, {limit: 1});
    assert.deepEqual(delivery, {delivered: 1, moreMayRemain: true});
    assert.equal(fake.calls, 1);
    assert.deepEqual(await state(admin), {ledger: 1, outbox: 1, delivered: 1});
    await assert.rejects(
      Ledger.recordEvent(pool, {
        userId: SUBJECT,
        eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        details: {}
      }),
      err => err.code === '42501'
    );
    const partial = await PrivacyErasureOutboxWorker.status(pool);
    assert.equal(partial.ready, false);
    assert.equal(partial.completeVisibility, false);
    const complete = await PrivacyErasureOutboxWorker.status(admin);
    assert.equal(complete.ready, true);
    assert.equal(complete.completeVisibility, true);

    console.log('GDPR_BACKEND_REAL_POOL_PG17_PASS ' + JSON.stringify({
      backendModule: 'api/config/database.js', actualSqlRoles: [WRITER, WORKER],
      verifiedLocalTlsPolicy: true, connectionParametersNormalized: true,
      noBypassRls: true, outboxAtomic: true, B2MockReceipts: true,
      workerNoWrite: true, noPublicHttp: true,
      realSupabaseCredentials: false, realRenderRuntime: false,
      realB2: false, productionUntouched: true
    }));
  } finally {
    if (activeBackend) await activeBackend.closePool();
    delete require.cache[DB_MODULE];
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (admin) await admin.end();
    await root.end();
  }
});
