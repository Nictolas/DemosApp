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
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/postgres') {
    throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
  }
  // Supabase direct database uses its project-specific hostname.
  // Supavisor uses a shared hostname with the project ref in the username.
  const direct = url.hostname === `db.${STAGING_REF}.supabase.co`;
  const pooler = url.hostname.endsWith('.pooler.supabase.com') &&
    url.username.endsWith(`.${STAGING_REF}`);
  if (!direct && !pooler) {
    throw new Error('GDPR_WRITER_ATTESTATION_INVALID_TARGET');
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
    c.relrowsecurity AS ledger_rls,
    c.relforcerowsecurity AS ledger_force_rls,
    (pg_catalog.pg_get_userbyid(c.relowner) = current_user) AS ledger_owner,
    pg_catalog.has_table_privilege(current_user, c.oid, 'INSERT') AS ledger_insert_grant,
    pg_catalog.has_table_privilege(current_user, c.oid, 'SELECT') AS ledger_select_grant
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'privacy_erasure_ledger'
    AND c.relkind IN ('r', 'p')
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
  const qualified = state.ledger_rls === true && state.ledger_insert_grant === true &&
    (state.ledger_owner === true || (state.bypass_rls === true && state.ledger_force_rls !== true));
  return {
    project: 'Demos-Staging', environment_target_checked: true,
    current_role: state.current_role, session_role: state.session_role,
    role_setting: state.role_setting,
    database_name: state.database_name,
    ledger_present: true, ledger_rls: state.ledger_rls === true,
    ledger_force_rls: state.ledger_force_rls === true,
    ledger_owner: state.ledger_owner === true,
    ledger_insert_grant: state.ledger_insert_grant === true,
    ledger_select_grant: state.ledger_select_grant === true,
    role_bypasses_rls: state.bypass_rls === true,
    sql_writer_attested: identityPresent,
    // Catalog checks cannot prove policy outcomes or actual recordEvent writes.
    catalog_eligibility: qualified ? 'POSSIBLE_NOT_PROVEN' : 'NOT_ATTESTED',
    live_render_pool_verified: false,
    status: 'READONLY_IDENTITY_ONLY_NOT_RELEASE_GO'
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
    if (!report.ledger_present || !report.sql_writer_attested) process.exitCode = 2;
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
