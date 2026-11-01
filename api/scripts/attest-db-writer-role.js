'use strict';

// Manual, read-only attestation for DEMOS issue #526 (REL-02).
// Never log a DSN, password, SQL errors, personal rows or client addresses.
// This is NOT a release approval or a replacement for multi-user QA.
const IMPORTANT_TABLES = Object.freeze([
  'users', 'user_consents', 'opinioni_risposte', 'political_selections',
  'privacy_erasure_ledger', 'user_rights_requests'
]);
const ROLE_SQL = [
  'SELECT current_user::text AS current_role, session_user::text AS session_role,',
  'COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user),false) AS current_bypassrls,',
  'COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = session_user),false) AS session_bypassrls,',
  'COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = current_user),false) AS current_superuser'
].join(' ');
const TABLE_SQL = [
  'SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,',
  'c.relforcerowsecurity AS force_rls,',
  'pg_get_userbyid(c.relowner) = current_user AS current_role_is_owner,',
  "has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,",
  "has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,",
  "has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,",
  "has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete",
  'FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
  "WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[])",
  'ORDER BY c.relname'
].join(' ');

function assess(role, tableRows, expected = IMPORTANT_TABLES) {
  if (!role || typeof role.current_role !== 'string' || typeof role.session_role !== 'string') {
    throw new Error('DB_ROLE_AUDIT_INVALID_METADATA');
  }
  const rows = Array.isArray(tableRows) ? tableRows : [];
  const present = new Set(rows.map(row => row.table_name));
  const missing = expected.filter(name => !present.has(name));
  const privilegeBypass = Boolean(role.current_bypassrls || role.session_bypassrls || role.current_superuser);
  const ownerBypass = rows.some(row => row.current_role_is_owner && !row.force_rls);
  const missingRls = rows.some(row => !row.rls_enabled);
  const gate = privilegeBypass ? 'NO_GO_PRIVILEGED_ROLE'
    : ownerBypass ? 'NO_GO_OWNER_BYPASS'
    : missingRls ? 'NO_GO_RLS_OFF'
    : missing.length ? 'INCOMPLETE_SCHEMA'
    : 'ROLE_METADATA_OK_E2E_STILL_REQUIRED';
  return {
    currentRole: role.current_role,
    sessionRole: role.session_role,
    currentBypassRls: Boolean(role.current_bypassrls),
    sessionBypassRls: Boolean(role.session_bypassrls),
    currentSuperuser: Boolean(role.current_superuser),
    examinedTables: rows.length,
    missingTables: missing,
    ownerBypass,
    missingRls,
    tablePrivileges: rows.map(row => ({
      table: row.table_name,
      rls: Boolean(row.rls_enabled),
      forceRls: Boolean(row.force_rls),
      owner: Boolean(row.current_role_is_owner),
      select: Boolean(row.can_select),
      insert: Boolean(row.can_insert),
      update: Boolean(row.can_update),
      delete: Boolean(row.can_delete)
    })),
    gate
  };
}

async function inspectPool(pool) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    // Both catalog queries must execute on the same actual database connection.
    await client.query('BEGIN TRANSACTION READ ONLY');
    transactionStarted = true;
    const role = await client.query(ROLE_SQL);
    const tables = await client.query(TABLE_SQL, [IMPORTANT_TABLES]);
    return assess(role.rows && role.rows[0], tables.rows);
  } finally {
    if (transactionStarted) {
      try { await client.query('ROLLBACK'); } catch (_) { /* never leak driver error */ }
    }
    client.release();
  }
}

// Do not assume config/db.js is always a separate Pool. PR #375 changes it
// to a frozen lazy proxy for the canonical singleton; calling .end() on that
// proxy is invalid, and connecting through it can initialize an unmanaged pool.
function classifyLegacyPool(legacyPool) {
  if (!legacyPool || typeof legacyPool.connect !== 'function') {
    return { mode: 'invalid', owned: false, inspect: false, gate: 'NO_GO_LEGACY_POOL_UNKNOWN' };
  }
  if (typeof legacyPool.end !== 'function') {
    // PR #375's facade exposes only query/connect, never end.
    // Shape inspection alone does not PROVE delegation; review it before release.
    const expectedFacade = Object.isFrozen(legacyPool) && typeof legacyPool.query === 'function';
    return {
      mode: expectedFacade ? 'canonical-facade' : 'unknown-proxy',
      owned: false,
      inspect: false,
      gate: expectedFacade ? 'INCOMPLETE_FACADE_CODE_REVIEW_REQUIRED' : 'NO_GO_LEGACY_PROXY_UNKNOWN'
    };
  }
  // Legacy independent Pool on main currently disables certificate validation.
  // Do not open a network connection through unverified TLS just to audit RLS.
  const tls = legacyPool.options && legacyPool.options.ssl;
  const verifiedTls = tls === true || Boolean(tls && typeof tls === 'object' && tls.rejectUnauthorized === true);
  if (!verifiedTls) {
    return { mode: 'independent-unverified-tls', owned: true, inspect: false, gate: 'NO_GO_LEGACY_TLS_UNVERIFIED' };
  }
  return { mode: 'independent-verified-tls', owned: true, inspect: true, gate: null };
}

async function attestConfiguredPools({ centralPool, legacyPool, inspect = inspectPool, emit = () => {} }) {
  const legacy = classifyLegacyPool(legacyPool);
  const owned = [centralPool];
  if (legacy.owned && legacyPool !== centralPool) owned.push(legacyPool);
  let anyNoGo = false;
  try {
    const canonicalEvidence = await inspect(centralPool);
    emit({ pool: 'central', ...canonicalEvidence });
    if (canonicalEvidence.gate !== 'ROLE_METADATA_OK_E2E_STILL_REQUIRED') anyNoGo = true;

    if (!legacy.inspect) {
      emit({ pool: 'legacy', mode: legacy.mode, gate: legacy.gate, independentlyVerified: false });
      // An unverified proxy or TLS connection MUST NOT close the release gate.
      return { anyNoGo: true };
    }
    const legacyEvidence = await inspect(legacyPool);
    emit({ pool: 'legacy', ...legacyEvidence });
    if (legacyEvidence.gate !== 'ROLE_METADATA_OK_E2E_STILL_REQUIRED') anyNoGo = true;
    return { anyNoGo };
  } finally {
    // Only Pools created for this probe are owned. NEVER close a lazy facade.
    await Promise.allSettled(owned.map(pool => pool.end()));
  }
}

async function runCli() {
  // Explicit operator guard prevents accidental production DB access.
  if (process.env.CONFIRM_DB_ROLE_AUDIT !== 'READ_ONLY_NO_PRODUCTION_DATA') {
    process.stderr.write('DB_ROLE_AUDIT_OPT_IN_REQUIRED\n');
    process.exitCode = 2;
    return;
  }
  if (!process.env.DATABASE_URL) {
    process.stderr.write('DB_ROLE_AUDIT_DATABASE_URL_UNAVAILABLE\n');
    process.exitCode = 2;
    return;
  }

  // Lazy imports: tests use mocks; no connections or credential reads on import.
  const { Pool } = require('pg');
  const { poolConfig } = require('../config/database');
  const centralPool = new Pool(poolConfig);
  let legacyPool;
  try {
    legacyPool = require('../config/db').pool;
  } catch (_) {
    await centralPool.end();
    process.stderr.write('DB_ROLE_AUDIT_FAILED_NO_DETAILS\n');
    process.exitCode = 4;
    return;
  }
  try {
    const result = await attestConfiguredPools({
      centralPool, legacyPool,
      emit: evidence => process.stdout.write(JSON.stringify(evidence) + '\n')
    });
    if (result.anyNoGo) process.exitCode = 3;
  } catch (_) {
    process.stderr.write('DB_ROLE_AUDIT_FAILED_NO_DETAILS\n');
    process.exitCode = 4;
  }
}

if (require.main === module) runCli().catch(() => {
  process.stderr.write('DB_ROLE_AUDIT_FAILED_NO_DETAILS\n');
  process.exitCode = 4;
});
module.exports = { IMPORTANT_TABLES, ROLE_SQL, TABLE_SQL, assess, inspectPool, classifyLegacyPool, attestConfiguredPools, runCli };
