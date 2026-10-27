'use strict';
// CI ONLY — uses a disposable PostgreSQL 17 service, never Supabase or Render.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');

const DATABASE_URL =
  'postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_contract_ci';
const USER = '00000000-0000-4000-8000-000000000301';
const OUTSIDER = '00000000-0000-4000-8000-000000000399';
const WRITER = 'gdpr_outbox_ci_writer';

function guard() {
  if (process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.GDPR_OUTBOX_CI !== 'isolated' ||
      process.env.TEST_DATABASE_URL !== DATABASE_URL ||
      process.env.DATABASE_URL || process.env.SUPABASE_DB_URL ||
      process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.RENDER || process.env.RENDER_SERVICE_ID) {
    throw Error('GDPR_OUTBOX_CI_REFUSES_NONLOCAL_DATABASE');
  }
}

async function counts(db) {
  const r = await db.query(`
    SELECT
      (SELECT COUNT(*)::integer FROM public.privacy_erasure_ledger) AS ledger,
      (SELECT COUNT(*)::integer FROM public.privacy_erasure_delivery_outbox) AS outbox
  `);
  return r.rows[0];
}

const event = (userId = USER, details = {source: 'synthetic-ci'}) => ({
  userId, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED, details
});

test('outbox feature is strictly opt-in and an invalid flag fails before SQL', async () => {
  const prior = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
  try {
    delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    assert.equal(Ledger.outboxEnabled(), false);
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'FALSE';
    await assert.rejects(
      Ledger.recordEvent({query() {throw Error('unexpected query');}}, event()),
      error => error.code === 'GDPR_ERASURE_OUTBOX_INVALID_MODE'
    );
  } finally {
    if (prior === undefined) delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    else process.env.GDPR_ERASURE_OUTBOX_ENABLED = prior;
  }
});

test('PG17 transactional event + outbox never loses #371 null-details protections', async () => {
  guard();
  process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
  const admin = new Pool({connectionString: DATABASE_URL, ssl: false, max: 2});
  let writer;
  try {
    const dbName = (await admin.query(
      'SELECT current_database() AS db, current_setting(\'server_version_num\')::integer AS version'
    )).rows[0];
    assert.equal(dbName.db, 'gdpr_outbox_contract_ci');
    assert.equal(Math.floor(dbName.version / 10000), 17);

    const deniedClient = {query() {throw Error('unexpected SQL after local validation');}};
    for (const invalid of [null, false, [], {payload: 'X'.repeat(9000)}]) {
      await assert.rejects(
        Ledger.recordEvent(deniedClient, event(USER, invalid)),
        /Invalid GDPR ledger details|minimization limit/
      );
    }

    // Neither user requests nor recordEvent may bootstrap any table.
    await assert.rejects(Ledger.recordEvent(admin, event()),
      error => error.code === '42P01');
    assert.equal((await admin.query(
      "SELECT to_regclass('public.privacy_erasure_ledger') AS rel"
    )).rows[0].rel, null);

    for (const role of ['anon','authenticated','service_role']) {
      await admin.query('CREATE ROLE ' + role + ' NOLOGIN');
    }
    await Ledger.ensureTable(admin);
    await assert.rejects(Ledger.recordEvent(admin, event()),
      error => error.code === '42P01');
    assert.equal((await admin.query(
      'SELECT COUNT(*)::integer AS n FROM public.privacy_erasure_ledger'
    )).rows[0].n, 0, 'missing outbox cannot leave an event behind');

    await Ledger.ensureDeliveryOutbox(admin);
    const security = (await admin.query(`
      SELECT c.relrowsecurity AS rls,
        c.relforcerowsecurity AS forced,
        (SELECT COUNT(*)::integer FROM pg_catalog.pg_roles r
         WHERE r.rolname IN ('anon','authenticated','service_role')
           AND (has_any_column_privilege(r.rolname,c.oid,'SELECT')
             OR has_any_column_privilege(r.rolname,c.oid,'INSERT')
             OR has_any_column_privilege(r.rolname,c.oid,'UPDATE')
             OR has_table_privilege(r.rolname,c.oid,'DELETE'))) AS exposed_api_roles
      FROM pg_catalog.pg_class c
      WHERE c.oid='public.privacy_erasure_delivery_outbox'::regclass
    `)).rows[0];
    assert.deepEqual(security, {rls: true, forced: true, exposed_api_roles: 0});

    // Even a preexisting table must not be used when FORCE RLS is removed.
    await admin.query('ALTER TABLE public.privacy_erasure_delivery_outbox NO FORCE ROW LEVEL SECURITY');
    await assert.rejects(Ledger.recordEvent(admin, event()),
      error => error.code === 'GDPR_OUTBOX_SCHEMA_NOT_PROTECTED');
    await admin.query('ALTER TABLE public.privacy_erasure_delivery_outbox FORCE ROW LEVEL SECURITY');
    assert.deepEqual(await counts(admin), {ledger: 0, outbox: 0});

    // Supabase-style API role grants are a hard failure, not an acceptable shortcut.
    await admin.query('GRANT SELECT ON public.privacy_erasure_delivery_outbox TO anon');
    await assert.rejects(Ledger.recordEvent(admin, event()),
      error => error.code === 'GDPR_OUTBOX_SCHEMA_NOT_PROTECTED');
    await admin.query('REVOKE SELECT ON public.privacy_erasure_delivery_outbox FROM anon');
    assert.deepEqual(await counts(admin), {ledger: 0, outbox: 0});

    // App failure/cancellation rolls back both tables, never just one.
    const tx = await admin.connect();
    try {
      await tx.query('BEGIN');
      const pending = await Ledger.recordEvent(tx, event());
      assert.equal(pending.subject_user_id, USER);
      assert.deepEqual(await counts(tx), {ledger: 1, outbox: 1});
      await tx.query('ROLLBACK');
    } finally {tx.release();}
    assert.deepEqual(await counts(admin), {ledger: 0, outbox: 0});

    // Distinct writer with RLS policies: not owner, no BYPASSRLS.
    await admin.query(`CREATE ROLE ${WRITER} LOGIN PASSWORD 'synthetic-ci-only' NOBYPASSRLS`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${WRITER}`);
    await admin.query(`GRANT SELECT,INSERT ON public.privacy_erasure_ledger TO ${WRITER}`);
    await admin.query(`GRANT SELECT,INSERT ON public.privacy_erasure_delivery_outbox TO ${WRITER}`);
    await admin.query(`CREATE POLICY gdpr_ci_ledger_insert ON public.privacy_erasure_ledger
      FOR INSERT TO ${WRITER} WITH CHECK (subject_user_id='${USER}')`);
    await admin.query(`CREATE POLICY gdpr_ci_ledger_select ON public.privacy_erasure_ledger
      FOR SELECT TO ${WRITER} USING (subject_user_id='${USER}')`);
    await admin.query(`CREATE POLICY gdpr_ci_outbox_insert ON public.privacy_erasure_delivery_outbox
      FOR INSERT TO ${WRITER} WITH CHECK (true)`);
    await admin.query(`CREATE POLICY gdpr_ci_outbox_select ON public.privacy_erasure_delivery_outbox
      FOR SELECT TO ${WRITER} USING (true)`);

    writer = new Pool({
      host: '127.0.0.1', port: 5432, user: WRITER,
      password: 'synthetic-ci-only', database: 'gdpr_outbox_contract_ci',
      ssl: false, max: 2
    });
    const who = (await writer.query(`SELECT current_user AS role_name,
      (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user) AS bypass
    `)).rows[0];
    assert.deepEqual(who, {role_name: WRITER, bypass: false});
    const committed = await Ledger.recordEvent(writer, event());
    assert.equal(committed.subject_user_id, USER);
    assert.deepEqual(await counts(admin), {ledger: 1, outbox: 1});

    // Without permission to queue, the ledger INSERT must not survive.
    await admin.query(`REVOKE INSERT ON public.privacy_erasure_delivery_outbox FROM ${WRITER}`);
    await assert.rejects(Ledger.recordEvent(writer, event()), 
      error => error.code === '42501');
    assert.deepEqual(await counts(admin), {ledger: 1, outbox: 1});
    await admin.query(`GRANT INSERT ON public.privacy_erasure_delivery_outbox TO ${WRITER}`);

    // The ledger policy must still reject other users in the same statement.
    await assert.rejects(Ledger.recordEvent(writer, event(OUTSIDER)),
      error => error.code === '42501');
    assert.deepEqual(await counts(admin), {ledger: 1, outbox: 1});

    assert.equal((await admin.query(`
      SELECT has_table_privilege('${WRITER}',
        'public.privacy_erasure_ledger','DELETE') AS ledger_delete,
        has_table_privilege('${WRITER}',
        'public.privacy_erasure_delivery_outbox','DELETE') AS outbox_delete
    `)).rows[0].ledger_delete, false);

    // The #371 import contract must still refuse missing/null JSONB payloads.
    const current = (await Ledger.captureCurrent(admin))[0];
    for (const details of [null, undefined, false, []]) {
      await assert.rejects(
        Ledger.mergeCaptured(admin, [{...current,event_key:'synthetic-import-override',details}]),
        error => error.code === 'GDPR_LEDGER_INVALID_CAPTURED_EVENT'
      );
    }
    assert.deepEqual(await counts(admin), {ledger: 1, outbox: 1});

    // Explicit old mode preserves backward compatibility without an outbox.
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'false';
    const legacy = await Ledger.recordEvent(writer, event());
    assert.equal(legacy.subject_user_id, USER);
    assert.deepEqual(await counts(admin), {ledger: 2, outbox: 1});

    console.log('GDPR_OUTBOX_ATOMIC_PG17_PASS ' + JSON.stringify({
      syntheticOnly: true, eventAndOutboxAtomic: true,
      rollbackTogether: true, nonownerNoBypass: true,
      deniedOutboxWriteLeavesNoEvent: true, rejectedOtherSubject: true,
      invalidDetailsFailClosed: true, defaultDisabled: true,
      productionUntouched: true
    }));
  } finally {
    delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    if (writer) await writer.end();
    await admin.end();
  }
});
