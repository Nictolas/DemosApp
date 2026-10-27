'use strict';
// Disposable GitHub Actions PostgreSQL 17 ONLY. Uses the same database pool
// configuration as the DEMOS backend to exercise real SQL role behaviour.
// Not a probe of Render, Supabase, or production privileges.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');

const DB = 'political_selection_erasure_ci';
const SUBJECT = 'synthetic-gdpr-pool-ci-subject';
const ROLE = 'gdpr_pool_writer_ci';
const PASS = 'synthetic-pool-only';
function guard(e) {
  if (e.GITHUB_ACTIONS !== 'true' || e.GDPR_WRITER_POOL_CI !== 'isolated' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== DB || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only' || e.DATABASE_URL ||
      e.SUPABASE_URL || e.SUPABASE_DB_URL || e.SUPABASE_SERVICE_ROLE_KEY ||
      e.RENDER || e.RENDER_SERVICE_ID) {
    throw new Error('GDPR_WRITER_POOL_CI_INVALID_TARGET');
  }
}
async function count(client) {
  const r = await client.query(
    'SELECT COUNT(*)::int AS count FROM public.privacy_erasure_ledger WHERE subject_user_id = $1',
    [SUBJECT]
  );
  return r.rows[0].count;
}
async function main() {
  guard(process.env);
  const admin = new Client({
    host: '127.0.0.1', port: 5432, database: DB,
    user: 'postgres', password: 'synthetic-only', ssl: false,
    connectionTimeoutMillis: 5000
  });
  let closePool = async () => {};
  let poolClient;
  await admin.connect();
  try {
    const db = (await admin.query(`
      SELECT current_database() AS database_name,
        current_user AS role_name,
        current_setting('server_version_num')::int AS server_version
    `)).rows[0];
    assert.equal(db.database_name, DB);
    assert.equal(db.role_name, 'postgres');
    assert.equal(Math.floor(db.server_version / 10000), 17);
    // Existing protected ledger was installed in the preceding synthetic CI
    // step. Fail closed if it was not installed by that step.
    await Ledger.assertProtectedLedger(admin);
    const catalog = (await admin.query(`
      SELECT c.relrowsecurity AS rls_enabled,
        pg_get_userbyid(c.relowner) AS owner_name
      FROM pg_catalog.pg_class c
      WHERE c.oid = 'public.privacy_erasure_ledger'::regclass
    `)).rows[0];
    assert.equal(catalog.rls_enabled, true);
    assert.equal(catalog.owner_name, 'postgres');

    // Role exists only in the per-job disposable PostgreSQL container.
    await admin.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASS}' NOBYPASSRLS`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
    await admin.query(`GRANT INSERT, SELECT ON TABLE public.privacy_erasure_ledger TO ${ROLE}`);
    const before = await count(admin);

    // Use actual backend config instead of a second handcrafted test pool.
    // This value is constructed exclusively after all local-CI guards pass.
    process.env.DATABASE_URL =
      `postgresql://${ROLE}:${PASS}@127.0.0.1:5432/${DB}`;
    process.env.DATABASE_POOL_MIN = '0';
    process.env.DATABASE_POOL_MAX = '2';
    const database = require('../config/database');
    closePool = database.closePool;
    assert.equal(database.poolConfig.ssl, false);
    assert.equal(database.poolConfig.min, 0);
    assert.equal(database.poolConfig.max, 2);
    poolClient = await database.getPool().connect();
    const writer = (await poolClient.query(`
      SELECT current_user AS role_name, current_database() AS database_name,
             (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user)
               AS bypass_rls
    `)).rows[0];
    assert.equal(writer.role_name, ROLE);
    assert.equal(writer.database_name, DB);
    assert.equal(writer.bypass_rls, false);

    // RLS with zero policies MUST block the same transaction path used
    // by the app even when INSERT/SELECT table grants exist.
    await poolClient.query('BEGIN');
    await assert.rejects(
      Ledger.recordEvent(poolClient, {
        userId: SUBJECT, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED
      }),
      error => error?.code === '42501'
    );
    await poolClient.query('ROLLBACK');
    assert.equal(await count(admin), before);

    // Synthetic demonstration ONLY: policies are scoped to a single fake
    // subject and never applied to Supabase/Render databases.
    await admin.query(`CREATE POLICY gdpr_pool_writer_ci_insert
      ON public.privacy_erasure_ledger FOR INSERT TO ${ROLE}
      WITH CHECK (subject_user_id = '${SUBJECT}')`);
    await admin.query(`CREATE POLICY gdpr_pool_writer_ci_select
      ON public.privacy_erasure_ledger FOR SELECT TO ${ROLE}
      USING (subject_user_id = '${SUBJECT}')`);

    await poolClient.query('BEGIN');
    const rolledBack = await Ledger.recordEvent(poolClient, {
      userId: SUBJECT, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      details: { fixture: 'rollback' }
    });
    assert.equal(rolledBack.subject_user_id, SUBJECT);
    await poolClient.query('ROLLBACK');
    assert.equal(await count(admin), before);

    await poolClient.query('BEGIN');
    const committed = await Ledger.recordEvent(poolClient, {
      userId: SUBJECT, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      details: { fixture: 'commit' }
    });
    assert.equal(committed.subject_user_id, SUBJECT);
    await poolClient.query('COMMIT');
    assert.equal(await count(admin), before + 1);

    // The narrow policy must not grant access to other subjects.
    await poolClient.query('BEGIN');
    await assert.rejects(
      Ledger.recordEvent(poolClient, {
        userId: 'another-synthetic-subject',
        eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_GRANTED
      }),
      error => error?.code === '42501'
    );
    await poolClient.query('ROLLBACK');
    assert.equal(await count(admin), before + 1);
    console.log('GDPR_BACKEND_POOL_PG17_PASS ' + JSON.stringify({
      environment: 'synthetic-ci-only', backendDatabaseModule: true,
      sqlRoleNotOwner: true, sqlRoleNoBypassRls: true,
      rlsDenyWithoutPolicies: true, rollbackPreservesLedger: true,
      committedSyntheticEvent: true, narrowPolicyRejectsOtherSubject: true,
      realRenderWriterAttested: false, productionUntouched: true
    }));
  } finally {
    if (poolClient) poolClient.release();
    await closePool();
    await admin.end();
    delete process.env.DATABASE_URL;
  }
}
if (require.main === module) {
  main().catch(error => {
    // Never print query strings, DSNs, pg connection details or secrets.
    console.error('GDPR_BACKEND_POOL_PG17_FAIL', error?.code || 'INVARIANT_FAILED');
    process.exitCode = 1;
  });
}
module.exports = { guard };
