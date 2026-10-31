'use strict';

// Operator-invoked, SELECT-only. NEVER wire this script to an HTTP endpoint.
// Deliberately limited to the already identified, separate Demos-Staging project.
const STAGING_REF = 'fkeayjzvtuvzesljhjbc';
const APPROVAL_MARKER = 'demos-staging-readonly-20261027';

function assertStagingTarget(env) {
  if (env.GDPR_WRITER_ATTESTATION !== APPROVAL_MARKER) {
    throw new Error('GDPR_WRITER_ATTESTATION_NOT_ENABLED');
  }
  if (typeof env.DATABASE_URL !== 'string' || !env.DATABASE_URL) {
    throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
  }
  let url;
  try { url = new URL(env.DATABASE_URL); } catch (_) {
    throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.pathname !== '/postgres' || url.hash || !url.hostname ||
      !url.username || !url.password) {
    throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
  }
  // This operator-only identity probe accepts the actual staging SQL role
  // (not assumed in advance), but NEVER a different project/region or
  // arbitrary port. A missing/downgraded TLS declaration is an unsafe
  // candidate even though the canonical backend pool separately enforces CA.
  const direct = url.hostname === `db.${STAGING_REF}.supabase.co` &&
    (!url.port || url.port === '5432');
  const pooler = /^aws-\d+-eu-central-1\.pooler\.supabase\.com$/.test(url.hostname) &&
    url.username.endsWith(`.${STAGING_REF}`) &&
    ['5432','6543'].includes(url.port);
  if (!direct && !pooler) {
    throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
  }
  if (url.searchParams.getAll('sslmode').length !== 1 ||
      url.searchParams.get('sslmode') !== 'require') {
    throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
  }
  const allowedParams = new Set(['sslmode', 'pgbouncer']);
  for (const [key,value] of url.searchParams) {
    if (!allowedParams.has(key) ||
        url.searchParams.getAll(key).length !== 1 ||
        (key === 'pgbouncer' && (!pooler || value !== 'true'))) {
      throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
    }
  }
  // Do not return, print or log any portion of the connection string.
  return { project: 'Demos-Staging', target_checked: true };
}

const SQL = `
  SELECT
    current_user AS current_role,
    session_user AS session_role,
    current_setting('role', true) AS role_setting,
    current_database() AS database_name,
    (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user)
      AS bypass_rls,
    (c.oid IS NOT NULL) AS ledger_present,
    c.relrowsecurity AS ledger_rls,
    c.relforcerowsecurity AS ledger_force_rls,
    (pg_catalog.pg_get_userbyid(c.relowner) = current_user) AS ledger_owner,
    pg_catalog.has_table_privilege(current_user, c.oid, 'INSERT') AS ledger_insert_grant,
    pg_catalog.has_table_privilege(current_user, c.oid, 'SELECT') AS ledger_select_grant,
    EXISTS (
      SELECT 1 FROM pg_catalog.aclexplode(
        COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
      ) acl WHERE acl.grantee = 0
    ) AS public_grants_exist,
    EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        AND acl.grantee = 0
    ) AS public_column_grants_exist,
    (
      SELECT COUNT(*)::integer FROM pg_catalog.pg_roles r
      WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
        AND (
          pg_catalog.has_any_column_privilege(r.rolname, c.oid, 'SELECT') OR
          pg_catalog.has_any_column_privilege(r.rolname, c.oid, 'INSERT') OR
          pg_catalog.has_any_column_privilege(r.rolname, c.oid, 'UPDATE') OR
          pg_catalog.has_table_privilege(r.rolname, c.oid, 'DELETE')
        )
    ) AS api_roles_with_dml_grants
  -- A singleton LEFT JOIN returns a session identity even when the ledger
  -- is absent in an otherwise empty staging database. No ledger rows are read.
  FROM (SELECT 1) anchor
  LEFT JOIN (
    SELECT c.*
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'privacy_erasure_ledger'
      AND c.relkind IN ('r', 'p')
  ) c ON true
`;

function publicReport(rows) {
  const state = rows?.[0];
  if (!state) return {
    project: 'Demos-Staging', environment_target_checked: true,
    ledger_present: false, status: 'NO_GO_MISSING_LEDGER',
    sql_writer_attested: false, live_render_pool_verified: false
  };
  const identityPresent = typeof state.current_role === 'string' &&
    typeof state.session_role === 'string' && !!state.database_name;
  // A missing ledger is a NO-GO, but must not hide the SQL identity evidence
  // needed to configure a safe staging process before operator-led bootstrap.
  if (state.ledger_present !== true) {
    return {
      project: 'Demos-Staging', environment_target_checked: true,
      current_role: state.current_role, session_role: state.session_role,
      role_setting: state.role_setting, database_name: state.database_name,
      ledger_present: false, sql_writer_attested: identityPresent,
      catalog_eligibility: 'NOT_ATTESTED', live_render_pool_verified: false,
      status: 'NO_GO_MISSING_LEDGER'
    };
  }
  // Match the fail-closed checks enforced by Ledger.assertProtectedLedger.
  // A positive writer/owner grant alone does NOT mean the ledger is safe.
  const ledgerProtected = state.ledger_rls === true &&
    state.public_grants_exist === false &&
    state.public_column_grants_exist === false &&
    state.api_roles_with_dml_grants === 0;
  const qualified = ledgerProtected && state.ledger_insert_grant === true &&
    state.ledger_select_grant === true &&
    ((state.ledger_owner === true && state.ledger_force_rls === false) ||
      state.bypass_rls === true);
  return {
    project: 'Demos-Staging', environment_target_checked: true,
    current_role: state.current_role, session_role: state.session_role,
    role_setting: state.role_setting,
    database_name: state.database_name,
    ledger_present: true, ledger_rls: state.ledger_rls === true,
    ledger_acl_protected: ledgerProtected,
    ledger_force_rls: state.ledger_force_rls === true,
    ledger_owner: state.ledger_owner === true,
    ledger_insert_grant: state.ledger_insert_grant === true,
    ledger_select_grant: state.ledger_select_grant === true,
    role_bypasses_rls: state.bypass_rls === true,
    sql_writer_attested: identityPresent,
    // Catalog checks cannot prove policy outcomes or actual recordEvent writes.
    catalog_eligibility: qualified ? 'POSSIBLE_NOT_PROVEN' : 'NOT_ATTESTED',
    live_render_pool_verified: false,
    status: ledgerProtected
      ? 'READONLY_IDENTITY_ONLY_NOT_RELEASE_GO'
      : 'NO_GO_LEDGER_SCHEMA_NOT_PROTECTED'
  };
}

async function main() {
  assertStagingTarget(process.env);
  // Import only *after* rejecting production/wrong credentials.
  // This uses the exact configured DEMOS database module but is a separate
  // process; it cannot attest the already-running Render process itself.
  const { getPool, closePool } = require('../config/database');
  const pool = getPool();
  let client;
  try {
    client = await pool.connect();
    const result = await client.query({ text: SQL, rowMode: 'object', query_timeout: 5000 });
    const report = publicReport(result.rows);
    process.stdout.write('GDPR_WRITER_READONLY_REPORT ' + JSON.stringify(report) + '\n');
    if (!report.ledger_present || !report.sql_writer_attested ||
        report.status !== 'READONLY_IDENTITY_ONLY_NOT_RELEASE_GO') {
      process.exitCode = 2;
    }
  } finally {
    if (client) client.release();
    await closePool();
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Do not print error.message, stack, URI, hostname or credentials.
    const safe = ['GDPR_WRITER_ATTESTATION_NOT_ENABLED',
      'GDPR_WRITER_ATTESTATION_INVALID_TARGET'].includes(error?.message)
      ? error.message : 'GDPR_WRITER_ATTESTATION_FAILED';
    process.stderr.write(safe + '\n');
    process.exitCode = 2;
  });
}

module.exports = { assertStagingTarget, publicReport, SQL };
