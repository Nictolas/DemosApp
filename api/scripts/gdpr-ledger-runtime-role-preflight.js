'use strict';
// Operator-only, one-shot metadata inspection through the EXACT PostgreSQL
// pool used by the DEMOS backend. No data rows, config/credential values,
// table mutations, user IDs, SQL role names or database names are returned.
const SQL = `
SELECT
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  (pg_get_userbyid(c.relowner) = current_user) AS role_is_owner,
  COALESCE(r.rolbypassrls, false) AS role_bypasses_rls,
  has_table_privilege(current_user, c.oid, 'SELECT') AS has_select_grant,
  has_table_privilege(current_user, c.oid, 'INSERT') AS has_insert_grant,
  (SELECT COUNT(*)::int FROM pg_catalog.pg_policy p
   WHERE p.polrelid = c.oid) AS policy_count,
  to_regclass('public.privacy_erasure_delivery_outbox') IS NOT NULL
    AS outbox_installed
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_roles r ON r.rolname = current_user
WHERE n.nspname = 'public'
  AND c.relname = 'privacy_erasure_ledger'
  AND c.relkind IN ('r', 'p')
`;
function sanitizedResult(row) {
  const common = {
    inspectionType: 'GDPR_LEDGER_SQL_ROLE_CATALOG_READ_ONLY',
    providerProjectVerified: false,
    externalLedgerComplete: false,
    isolationVerified: false
  };
  if (!row) return { ...common, verdict: 'NO_GO_LEDGER_MISSING' };
  const keys = ['rls_enabled', 'rls_forced', 'role_is_owner',
    'role_bypasses_rls', 'has_select_grant', 'has_insert_grant',
    'outbox_installed'];
  if (keys.some(k => typeof row[k] !== 'boolean') ||
      !Number.isInteger(row.policy_count) || row.policy_count < 0) {
    return { ...common, verdict: 'NO_GO_UNRELIABLE_CATALOG_RESULT' };
  }
  const observations = {
    ledgerRlsEnabled: row.rls_enabled,
    ledgerRlsForced: row.rls_forced,
    runtimeRoleIsLedgerOwner: row.role_is_owner,
    runtimeRoleBypassesRls: row.role_bypasses_rls,
    runtimeRoleHasSelectGrant: row.has_select_grant,
    runtimeRoleHasInsertGrant: row.has_insert_grant,
    ledgerPolicyCount: row.policy_count,
    outboxInstalled: row.outbox_installed
  };
  let verdict='MANUAL_INDEPENDENT_REVIEW_REQUIRED';
  if (!row.rls_enabled) verdict='NO_GO_RLS_DISABLED';
  else if (!row.has_select_grant || !row.has_insert_grant)
    verdict='NO_GO_INSUFFICIENT_SQL_GRANTS';
  else if ((!row.role_is_owner || row.rls_forced) &&
           !row.role_bypasses_rls && row.policy_count===0)
    verdict='NO_GO_RLS_DEFAULT_DENY';
  // Even plausible owner privileges do not demonstrate an actual safe write,
  // identify the Supabase project or prove isolation; never return GO.
  return { ...common, verdict, observations };
}
async function inspectRuntimeGdprLedgerRole(pool) {
  if (!pool || typeof pool.connect !== 'function')
    throw Error('Invalid SQL pool');
  const client=await pool.connect();
  try {
    // Only a fixed pg_catalog SELECT; no event rows or INSERT probes.
    const response=await client.query(SQL);
    if (!response || !Array.isArray(response.rows) || response.rows.length > 1)
      return {verdict:'NO_GO_UNRELIABLE_CATALOG_RESULT',
        inspectionType:'GDPR_LEDGER_SQL_ROLE_CATALOG_READ_ONLY',
        providerProjectVerified:false,externalLedgerComplete:false,
        isolationVerified:false};
    return sanitizedResult(response.rows[0]);
  } finally {
    client.release();
  }
}
// This one-shot CLI must NOT use database.getPool(): the application
// singleton attaches verbose connect/client/error listeners that may print
// raw connection errors, including potentially sensitive driver metadata.
// The dedicated pool uses the exact backend connection configuration and
// CA policy, but no app logging hooks. No new credential is requested.
function makeOneShotBackendConfigPool() {
  if (!process.env.DATABASE_URL) throw Error('Required DB configuration missing');
  const { Pool } = require('pg');
  const { poolConfig } = require('../config/database');
  const pool = new Pool({
    ...poolConfig, max: 1, min: 0,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    query_timeout: 5000
  });
  // Suppress raw driver exceptions from idle pool errors. The result still
  // fails closed; no secret-bearing exception is printed by this CLI.
  pool.on('error', () => {});
  return pool;
}

async function runOperatorRolePreflight({
  env = process.env, createPool = makeOneShotBackendConfigPool,
  writeOut = message => process.stdout.write(message),
  writeErr = message => process.stderr.write(message)
} = {}) {
  if (env.DEMOS_GDPR_ROLE_PREFLIGHT_READONLY !== 'acknowledged') {
    writeErr('GDPR_SQL_ROLE_PREFLIGHT_NOT_AUTHORIZED\n');
    return 2;
  }
  let pool = null, result = null, failed = false;
  try {
    pool = await createPool();
    result = await inspectRuntimeGdprLedgerRole(pool);
  } catch (_) {
    failed = true;
  } finally {
    if (pool && typeof pool.end === 'function') {
      try {
        await pool.end();
      } catch (_) {
        failed = true;
      }
    } else {
      failed = true;
    }
  }
  // Never print partial success before the connection closes reliably.
  if (failed) {
    writeErr('GDPR_SQL_ROLE_PREFLIGHT_FAILED\n');
    return 1;
  }
  writeOut(JSON.stringify(result)+'\n');
  // Even a complete catalog result is MANUAL REVIEW, not recovery approval.
  // No automatic system should interpret process exit 0 as GDPR recovery GO.
  return result.verdict === 'MANUAL_INDEPENDENT_REVIEW_REQUIRED' ? 2 : 1;
}

module.exports={ inspectRuntimeGdprLedgerRole, runOperatorRolePreflight };

if (require.main === module) {
  runOperatorRolePreflight().then(
    code => { process.exitCode = code; },
    () => {
      // Defensive last-chance sanitization; no raw DB/driver error text.
      process.stderr.write('GDPR_SQL_ROLE_PREFLIGHT_FAILED\n');
      process.exitCode = 1;
    }
  );
}
