'use strict';

// Dedicated, least-privilege connection for the opt-in audit outbox.
// The existing DEMOS application pool MUST NOT be reused for this purpose.
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { buildDatabaseSsl } = require('../utils/databaseTlsPolicy');
const { assertOutboxProjectScope } = require('./auditOutboxProjectScope');
const REQUIRED_ROLE = 'demos_outbox_worker';

function createAuditOutboxDatabase({
  env = process.env,
  PoolClass = Pool,
  ca = () => fs.readFileSync(path.join(__dirname, '..', 'certs', 'prod-ca-2021.crt'), 'utf8')
} = {}) {
  const connectionString = env.AUDIT_OUTBOX_DATABASE_URL;
  if (!connectionString) throw new Error('AUDIT_OUTBOX_DATABASE_URL_REQUIRED');
  if (connectionString === env.DATABASE_URL) {
    throw new Error('AUDIT_OUTBOX_DATABASE_URL_MUST_BE_DISTINCT');
  }

  let parsed;
  try {
    parsed = new URL(connectionString);
    if (!['postgresql:', 'postgres:'].includes(parsed.protocol) ||
        !parsed.hostname || !parsed.username || !parsed.password) {
      throw new Error('BAD_URL');
    }
  } catch (_error) {
    throw new Error('AUDIT_OUTBOX_DATABASE_URL_INVALID');
  }

  // Compare tenant identities before even constructing the connection pool.
  // The scope is pinned to the explicit DEMOS project references, never to
  // the hostname alone, and refuses cross-project credentials.
  assertOutboxProjectScope({
    mainUrl: env.DATABASE_URL,
    outboxUrl: connectionString,
    deploymentScope: env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE,
    nodeEnv: env.NODE_ENV
  });

  // SSL URL query values must not override the verified Supabase certificate
  // policy enforced by the common production database configuration.
  for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslaccept']) {
    parsed.searchParams.delete(name);
  }
  const ssl = buildDatabaseSsl(connectionString, { supabaseCa: ca() });
  const pool = new PoolClass({
    connectionString: parsed.toString(),
    ssl,
    max: 2,
    min: 0,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
    application_name: 'demos-audit-outbox'
  });

  let validated;
  async function ensureReady() {
    if (!validated) {
      validated = (async () => {
        // Query deliberately includes only role and grant flags: no credentials
        // or event payloads. The result is never printed or returned externally.
        const result = await pool.query(`
          SELECT r.rolsuper AS is_superuser,
                 r.rolbypassrls AS bypass_rls,
                 r.rolcanlogin AS can_login,
                 r.rolcreatedb AS can_create_database,
                 r.rolcreaterole AS can_create_roles,
                 r.rolreplication AS can_replicate,
                 pg_has_role(CURRENT_USER, $1, 'member') AS worker_member,
                 has_schema_privilege(CURRENT_USER, 'demos_private', 'USAGE') AS schema_access,
                 has_table_privilege(CURRENT_USER,
                   'demos_private.audit_delivery_outbox', 'SELECT') AS can_select,
                 has_table_privilege(CURRENT_USER,
                   'demos_private.audit_delivery_outbox', 'INSERT') AS can_insert,
                 has_table_privilege(CURRENT_USER,
                   'demos_private.audit_delivery_outbox', 'UPDATE') AS can_update,
                 has_table_privilege(CURRENT_USER,
                   'demos_private.audit_delivery_outbox', 'DELETE') AS can_delete,
                 (SELECT c.relrowsecurity FROM pg_class c
                   WHERE c.oid='demos_private.audit_delivery_outbox'::regclass) AS rls_enabled,
                 has_schema_privilege(CURRENT_USER, 'public', 'CREATE') AS can_create_public,
                 -- Checking the real authenticated LOGIN is essential: membership
                 -- in the restricted worker does NOT exclude PUBLIC or other grants.
                 (SELECT COUNT(*)::integer
                    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND n.nspname NOT LIKE 'pg_%'
                      AND NOT (n.nspname = 'demos_private' AND
                               c.relname = 'audit_delivery_outbox')
                      AND c.relkind IN ('r','p','v','m','f')
                      AND has_schema_privilege(CURRENT_USER, n.oid, 'USAGE')
                      AND (
                        has_table_privilege(CURRENT_USER,c.oid,'SELECT') OR
                        has_table_privilege(CURRENT_USER,c.oid,'INSERT') OR
                        has_table_privilege(CURRENT_USER,c.oid,'UPDATE') OR
                        has_table_privilege(CURRENT_USER,c.oid,'DELETE') OR
                        has_table_privilege(CURRENT_USER,c.oid,'TRUNCATE') OR
                        has_table_privilege(CURRENT_USER,c.oid,'REFERENCES') OR
                        has_table_privilege(CURRENT_USER,c.oid,'TRIGGER')
                      )) AS unrelated_table_grants,
                 -- PUBLIC EXECUTE on SECURITY DEFINER routines is an implicit
                 -- privilege and could expose rows outside the private outbox.
                 (SELECT COUNT(*)::integer
                    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND n.nspname NOT LIKE 'pg_%'
                      AND p.prosecdef
                      AND has_schema_privilege(CURRENT_USER,n.oid,'USAGE')
                      AND has_function_privilege(CURRENT_USER,p.oid,'EXECUTE')
                 ) AS unrelated_definer_grants,
                 (SELECT COUNT(*)::integer FROM pg_roles other
                    WHERE other.oid <> r.oid AND other.rolname <> $1
                      AND pg_has_role(CURRENT_USER, other.oid, 'member')
                 ) AS unrelated_role_memberships
          FROM pg_roles r WHERE r.rolname = CURRENT_USER
        `, [REQUIRED_ROLE]);
        const role = result.rows?.[0];
        if (!role || role.is_superuser !== false || role.bypass_rls !== false ||
            role.can_login !== true || role.worker_member !== true ||
            role.can_create_database !== false || role.can_create_roles !== false ||
            role.can_replicate !== false || role.can_create_public !== false ||
            role.unrelated_table_grants !== 0 || role.unrelated_definer_grants !== 0 ||
            role.unrelated_role_memberships !== 0 ||
            role.schema_access !== true || role.can_select !== true ||
            role.can_insert !== true || role.can_update !== true ||
            role.can_delete !== true || role.rls_enabled !== true) {
          throw new Error('AUDIT_OUTBOX_DATABASE_ROLE_UNSAFE');
        }
        return true;
      })().catch(_error => {
        // A transient database outage can be rechecked on a later attempt.
        // Always raise a fixed code to avoid leaking driver URLs and PII.
        validated = undefined;
        throw new Error('AUDIT_OUTBOX_DATABASE_PREFLIGHT_FAILED');
      });
    }
    return validated;
  }

  return { pool, ensureReady };
}

module.exports = { createAuditOutboxDatabase };
