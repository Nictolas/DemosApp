'use strict';

// Read-only Supabase staging preflight. Nothing is written to the database.
const fs = require('node:fs');
const path = require('node:path');
const {buildDatabaseSsl} = require('../utils/databaseTlsPolicy');

const STAGING_REF = 'fkeayjzvtuvzesljhjbc';
const STAGING_PREFLIGHT_ROLE = 'demos_staging_preflight';
const STAGING_IDENTITY_HASH = '0cbb6ace68a9f11956904e2a37898ec8';
const REQUIRED_TABLES = Object.freeze([
  'users', 'user_consents', 'opinioni_risposte', 'notifiche_preferenze',
  'eventi', 'programmi', 'civic_processes', 'iniziative_ministero', 'eci',
  'user_profile', 'notifiche_demos', 'iniziative_popolari', 'referendum_abrogativi',
  'active_sessions', 'ice', 'comunicazioni', 'unita_elettorale', 'candidati',
  'political_candidacies', 'political_mandates', 'parlamento', 'votazioni_parlamento',
  'opinioni_domande', 'voti_referendum_abrogativi', 'notifiche_voti_parlamento', 'voti_camera',
  'civic_ballots', 'civic_ballot_positions', 'notifiche_avvistamenti', 'notifiche_comunali',
  'notifiche_voti_comuni', 'political_opinion_notifications', 'segnalazioni',
  'preference_change_cooldowns', 'civic_ballot_forecast_snapshots',
]);
// Core staging tables deny direct client access, regardless of any broad Data API defaults.
const CIVIC_PRIVATE_TABLES = Object.freeze([
  'notifiche_preferenze', 'user_devices', 'civic_new_initiative_notifications',
  'civic_push_delivery_guard', 'civic_runtime_identity',
  'user_profile', 'notifiche_demos', 'iniziative_popolari', 'referendum_abrogativi',
  'active_sessions', 'ice', 'comunicazioni', 'unita_elettorale', 'candidati',
  'political_candidacies', 'political_mandates', 'parlamento', 'votazioni_parlamento',
  'opinioni_domande', 'voti_referendum_abrogativi', 'notifiche_voti_parlamento', 'voti_camera',
  'civic_ballots', 'civic_ballot_positions', 'notifiche_avvistamenti', 'notifiche_comunali',
  'notifiche_voti_comuni', 'political_opinion_notifications', 'segnalazioni',
  'preference_change_cooldowns', 'civic_ballot_forecast_snapshots',
]);

function assertStagingTarget(value, env = process.env) {
  if (env.NODE_ENV !== 'staging' || env.DEMOS_UNIFIED_STAGING_MODE !== 'preflight') {
    throw new Error('Refusing preflight outside explicitly authorized staging mode');
  }
  if (!value) throw new Error('DATABASE_URL is missing');
  let url;
  try { url = new URL(value); } catch (_) { throw new Error('DATABASE_URL is invalid'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Expected a PostgreSQL connection string');
  }
  const host = url.hostname.toLowerCase();
  const username = decodeURIComponent(url.username);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database !== 'postgres') throw new Error('Unexpected staging database name');
  if (!url.password) throw new Error('Staging credentials missing');
  // Only dedicated session endpoints are allowed: transaction-mode Supavisor
  // (6543) cannot preserve the PostgreSQL session required by civic locks.
  // The staging preflight is still read-only and NEVER proves session affinity.
  const isDirect = host === `db.${STAGING_REF}.supabase.co` && username === STAGING_PREFLIGHT_ROLE && (url.port === '' || url.port === '5432');
  const isPooler = host.endsWith('.pooler.supabase.com') && username === `${STAGING_PREFLIGHT_ROLE}.${STAGING_REF}` && url.port === '5432';
  if (!isDirect && !isPooler) throw new Error('Refusing non-session Supabase staging endpoint');
  // Reject driver URI parameters that can silently override the validated
  // host/port/user or force transaction pooling. TLS is centrally configured,
  // so SSL URL overrides are discarded rather than trusted.
  const ignoredSsl = new Set(['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslaccept']);
  for (const key of [...url.searchParams.keys()]) {
    if (!ignoredSsl.has(key.toLowerCase())) throw new Error('Unsafe staging connection options');
    url.searchParams.delete(key);
  }
  return {sanitizedConnectionString: url.toString(), target: 'Demos-Staging'};
}

function evaluateSchema(present, required = REQUIRED_TABLES) {
  if (!Array.isArray(present) || !Array.isArray(required)) {
    return {ready:false,presentCount:0,requiredCount:REQUIRED_TABLES.length,missing:[...REQUIRED_TABLES]};
  }
  const set = new Set(present);
  const missing = required.filter(name => !set.has(name));
  return {ready: missing.length === 0, presentCount: required.length - missing.length, requiredCount: required.length, missing};
}

// Every new public table in the shared Supabase staging must opt into RLS
// and deny direct anon/authenticated grants. This prevents future route
// migrations from silently expanding the public Data API attack surface.
function evaluateAllPublicStagingTables(rows) {
  if (!Array.isArray(rows)) return {ready:false,checkedCount:0,unsafe:['metadata_unavailable']};
  const unsafe = rows.filter(row =>
    !row || typeof row !== 'object' || !row.table_name || row.rls_enabled !== true ||
    row.anon_can_access !== false || row.authenticated_can_access !== false
  ).map(row => row?.table_name || 'unknown');
  return {ready:rows.length>0 && unsafe.length===0,checkedCount:rows.length,unsafe};
}

function evaluatePublicSequenceProtection(rows) {
  if (!Array.isArray(rows)) return {ready:false,checkedCount:0,unsafe:['metadata_unavailable']};
  const unsafe = rows.filter(row =>
    !row || typeof row !== 'object' || !row.sequence_name || row.anon_can_access !== false ||
    row.authenticated_can_access !== false
  ).map(row => row?.sequence_name || 'unknown');
  return {ready:unsafe.length===0,checkedCount:rows.length,unsafe};
}

// PostgreSQL views/materialized views/foreign tables are outside ordinary
// table-RLS checks. Disallow any direct client grant, including column grants.
function evaluatePublicViewExposure(rows) {
  if (!Array.isArray(rows)) return {ready:false,checkedCount:0,unsafe:['metadata_unavailable']};
  const unsafe = rows.filter(row =>
    !row || typeof row !== 'object' || !row.object_name || !['v','m','f'].includes(row.relkind) ||
    row.anon_can_access !== false || row.authenticated_can_access !== false
  ).map(row => row?.object_name || 'unknown');
  return {ready:unsafe.length===0,checkedCount:rows.length,unsafe};
}

// Functions/procedures/aggregates are a separate PostgREST RPC surface.
// EXECUTE defaults to PUBLIC on new PostgreSQL routines, and SECURITY DEFINER
// can run with privileges which the API caller does not have.
function evaluatePublicRoutineExposure(rows) {
  if (!Array.isArray(rows)) return {ready:false,checkedCount:0,unsafe:['metadata_unavailable']};
  const unsafe = rows.filter(row =>
    !row || typeof row !== 'object' || !row.routine_name || row.anon_can_execute !== false ||
    row.authenticated_can_execute !== false
  ).map(row => row?.routine_name || 'unknown');
  return {ready:unsafe.length===0,checkedCount:rows.length,unsafe};
}

function evaluateCivicProtection(rows, required = CIVIC_PRIVATE_TABLES) {
  if (!Array.isArray(rows) || !Array.isArray(required)) {
    return {ready:false,checkedCount:0,requiredCount:CIVIC_PRIVATE_TABLES.length,unsafe:[...CIVIC_PRIVATE_TABLES]};
  }
  const byName = new Map(rows.filter(row => row && typeof row === 'object').map(row => [row.table_name, row]));
  const unsafe = required.filter(name => {
    const row = byName.get(name);
    return !row || row.rls_enabled !== true ||
      row.anon_can_access !== false || row.authenticated_can_access !== false;
  });
  return {
    ready: unsafe.length === 0,
    checkedCount: required.length - unsafe.length,
    requiredCount: required.length,
    unsafe,
  };
}

// Strict civic runtime schema contract, including the users.status field
// required to exclude inactive accounts. Metadata only: no tokens or users.
const CIVIC_RUNTIME_COLUMNS = Object.freeze([
  ['users','id','uuid'], ['users','status','varchar'],
  ['user_devices','user_id','uuid'], ['user_devices','fcm_token','text'],
  ['user_devices','is_active','bool'],
  ['notifiche_preferenze','user_id','uuid'],
  ['notifiche_preferenze','eci','bool','false'],
  ['notifiche_preferenze','iniziative_popolari','bool','false'],
  ['notifiche_preferenze','referendum_abrogativi','bool','false'],
  ['civic_push_delivery_guard','id','int2'],
  ['civic_push_delivery_guard','blocked','bool','true'],
  ['civic_push_delivery_guard','reason_code','text'],
  ['civic_runtime_identity','id','int2'],
  ['civic_runtime_identity','db_identity','uuid'],
  ['civic_new_initiative_notifications','id','int8'],
  ['civic_new_initiative_notifications','category','text'],
  ['civic_new_initiative_notifications','official_id','text'],
  ['civic_new_initiative_notifications','status','text'],
]);
function evaluateCivicRuntimeColumns(rows) {
  if (!Array.isArray(rows)) {
    return {ready:false,checkedCount:0,requiredCount:CIVIC_RUNTIME_COLUMNS.length,
      invalid:CIVIC_RUNTIME_COLUMNS.map(([table,column]) => table + '.' + column)};
  }
  const indexed = new Map(rows.filter(row => row && typeof row === 'object').map(row => [row.table_name + '.' + row.column_name, row]));
  const invalid = CIVIC_RUNTIME_COLUMNS.filter(([table,column,type,defaultValue]) => {
    const row = indexed.get(table + '.' + column);
    if (!row || row.udt_name !== type) return true;
    if (!(table === 'users' && column === 'status') && row.is_nullable !== 'NO') return true;
    if (defaultValue && String(row.column_default || '').trim().toLowerCase() !== defaultValue) return true;
    return false;
  }).map(([table,column]) => table + '.' + column);
  return { ready: invalid.length === 0, checkedCount: CIVIC_RUNTIME_COLUMNS.length - invalid.length,
    requiredCount: CIVIC_RUNTIME_COLUMNS.length, invalid };
}
function evaluateStagingIdentity(rows) {
  return Array.isArray(rows) && rows.length === 1 &&
    rows[0]?.identity_hash === STAGING_IDENTITY_HASH;
}
function evaluateBlockedGuard(rows) {
  return Array.isArray(rows) && rows.length === 1 && rows[0]?.blocked === true;
}

// Verify actual PostgreSQL session identity and capabilities, not just
// a username in a connection URL. Refuse privileged or writable roles.
// PostgreSQL NOINHERIT does not disable SET ROLE to a granted parent role;
// require absolutely no parent role memberships (even SET FALSE) to fail closed.
function evaluatePreflightRole(rows) {
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const r = rows[0];
  return r.username === STAGING_PREFLIGHT_ROLE &&
    r.read_only === 'on' && r.rolcanlogin === true &&
    r.rolsuper === false && r.rolbypassrls === false &&
    r.rolcreatedb === false && r.rolcreaterole === false &&
    r.rolinherit === false && r.has_role_memberships === false &&
    r.can_create_schema === false && r.can_create_database === false;
}
function evaluatePreflightWriteGrants(rows) {
  return Array.isArray(rows) && rows.length > 0 &&
    rows.every(r => r && typeof r === 'object' && typeof r.table_name === 'string' &&
      r.table_name.length > 0 && r.can_write === false);
}

// The dedicated preflight role may read ONLY four metadata columns in two
// staging guard tables. READ ONLY transactions prevent writes but not a
// leaked broad SELECT grant; check every public column and sequence in catalog.
function evaluatePreflightReadGrants(rows) {
  const allowed = new Set([
    'civic_runtime_identity.id',
    'civic_runtime_identity.db_identity',
    'civic_push_delivery_guard.id',
    'civic_push_delivery_guard.blocked',
  ]);
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' ||
        typeof row.table_name !== 'string' || !row.table_name ||
        typeof row.column_name !== 'string' || !row.column_name ||
        typeof row.can_read !== 'boolean') return false;
    const key = row.table_name + '.' + row.column_name;
    if (seen.has(key) || row.can_read !== allowed.has(key)) return false;
    seen.add(key);
  }
  return [...allowed].every(key => seen.has(key));
}

// Effective RLS for the dedicated role must consist of the two *exact*
// SELECT(id=1) policies and no broader role/PUBLIC policies. An unrelated
// runtime-only policy is allowed, but is never interpreted as authorization.
function evaluatePreflightPolicies(rows) {
  if (!Array.isArray(rows)) return false;
  const expected = new Map([
    ['civic_runtime_identity', 'stg_preflight_identity_id1'],
    ['civic_push_delivery_guard', 'stg_preflight_guard_id1'],
  ]);
  const found = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' ||
        !expected.has(row.table_name) || typeof row.policy_name !== 'string' ||
        !Array.isArray(row.roles) || typeof row.cmd !== 'string') return false;
    const applies = row.roles.includes('public') ||
                    row.roles.includes('PUBLIC') ||
                    row.roles.includes(STAGING_PREFLIGHT_ROLE);
    if (!applies) continue; // e.g. existing staging runtime policies.
    const predicate = typeof row.qual === 'string'
      ? row.qual.replace(/\s+/g, '').replace(/[()]/g, '') : '';
    if (row.policy_name !== expected.get(row.table_name) ||
        row.roles.length !== 1 || row.roles[0] !== STAGING_PREFLIGHT_ROLE ||
        row.cmd !== 'SELECT' || predicate !== 'id=1' ||
        row.with_check != null || found.has(row.table_name)) return false;
    found.add(row.table_name);
  }
  return found.size === expected.size;
}

async function run(env = process.env) {
  // The shared staging service is still in bootstrap. Target validation alone
  // does not authorize even a read-only network connection to Demos-Staging.
  // A separate, explicit operator GO must be granted after consolidation.
  if (env.DEMOS_UNIFIED_STAGING_PREFLIGHT_GO !== 'APPROVED_READ_ONLY_PREFLIGHT') {
    throw new Error('Unified staging preflight not authorized while bootstrap is incomplete');
  }
  const {sanitizedConnectionString} = assertStagingTarget(env.STAGING_PREFLIGHT_DATABASE_URL, env);
  // Delayed import: static checks and unit tests need no database driver.
  // No network-capable client is even constructed before both gates pass.
  const {Client} = require('pg');
  const ca = fs.readFileSync(path.join(__dirname, '..', 'certs', 'prod-ca-2021.crt'), 'utf8');
  const client = new Client({
    connectionString: sanitizedConnectionString,
    ssl: buildDatabaseSsl(sanitizedConnectionString, {supabaseCa: ca}),
    application_name: 'demos-unified-staging-readonly-preflight',
    connectionTimeoutMillis: 12000, query_timeout: 12000, statement_timeout: 12000
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const identity = await client.query('SELECT current_database() AS db');
    if (identity.rows[0]?.db !== 'postgres') throw new Error('Connected to wrong database');
    const stagingIdentity = await client.query(
      'SELECT md5(db_identity::text) AS identity_hash FROM public.civic_runtime_identity WHERE id = 1'
    );
    if (!evaluateStagingIdentity(stagingIdentity.rows)) {
      throw new Error('Connected to unauthorized database identity');
    }
    // A read-only transaction alone is not sufficient: the credential must
    // itself have no elevated privileges for later transactions.
    const roleCheck = await client.query(
      `SELECT current_user AS username,
              current_setting('transaction_read_only') AS read_only,
              r.rolcanlogin, r.rolsuper, r.rolbypassrls,
              r.rolcreatedb, r.rolcreaterole, r.rolinherit,
              -- NOINHERIT still permits SET ROLE when any membership has SET TRUE.
              -- Require zero parent memberships, even if they currently have SET FALSE.
              EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
                      WHERE m.member = r.oid) AS has_role_memberships,
              has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema,
              has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_database
         FROM pg_catalog.pg_roles r WHERE r.rolname = current_user`
    );
    if (!evaluatePreflightRole(roleCheck.rows)) {
      throw new Error('Staging preflight role is privileged or unauthorized');
    }
    // Whole-table grants are NOT the full privilege picture: PostgreSQL
    // supports INSERT/UPDATE/REFERENCES per column, plus USAGE/UPDATE on
    // sequences. Query metadata only, never table rows or sequence values.
    const writeCheck = await client.query(
      `SELECT c.relname AS table_name,
              (has_table_privilege(current_user, c.oid,
                 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
               OR has_any_column_privilege(current_user, c.oid,
                 'INSERT,UPDATE,REFERENCES')) AS can_write
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
       UNION ALL
       SELECT c.relname AS table_name,
              has_sequence_privilege(current_user, c.oid,
                'USAGE,UPDATE') AS can_write
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'S'`
    );
    if (!evaluatePreflightWriteGrants(writeCheck.rows)) {
      throw new Error('Staging preflight has unexpected table write grants');
    }
    // Query catalog metadata only. Reject accidental SELECT grants to the
    // user table, notification content, other guard columns or sequences.
    // An explicitly READ ONLY transaction does not by itself limit SELECT.
    const readCheck = await client.query(
      `SELECT c.relname AS table_name, a.attname AS column_name,
              has_column_privilege(current_user, c.oid, a.attnum, 'SELECT') AS can_read
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
              AND a.attnum > 0 AND NOT a.attisdropped
         WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
       UNION ALL
       SELECT c.relname AS table_name, '<sequence>' AS column_name,
              has_sequence_privilege(current_user, c.oid,
                'SELECT,USAGE,UPDATE') AS can_read
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'S'`
    );
    if (!evaluatePreflightReadGrants(readCheck.rows)) {
      throw new Error('Staging preflight has unexpected SELECT grants');
    }
    // A SELECT-only role can still see more rows if RLS policies intended
    // for PUBLIC or the role are overly permissive. Review the effective
    // policy catalog without querying any user or notification content.
    const policyRows = await client.query(
      `SELECT tablename AS table_name, policyname AS policy_name, cmd,
              roles::text[] AS roles, qual, with_check
         FROM pg_catalog.pg_policies
         WHERE schemaname = 'public'
           AND tablename IN ('civic_runtime_identity','civic_push_delivery_guard')`
    );
    if (!evaluatePreflightPolicies(policyRows.rows)) {
      throw new Error('Staging preflight RLS policies are broader than authorized');
    }
    const tables = await client.query(
      `SELECT c.relname AS table_name FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relkind IN ('r','p') AND c.relname = ANY($2::text[])`,
      ['public', [...REQUIRED_TABLES]]
    );
    // Audit ALL public tables, including future P0/P1 migrations; a
    // previously unlisted table must not bypass RLS/client-grant checks.
    // pg_catalog metadata only: no account or notification rows read.
    const protectionRows = await client.query(
      `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
              (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
               OR has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
                 AS anon_can_access,
              (has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
               OR has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
                 AS authenticated_can_access
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relkind IN ('r', 'p')`,
      ['public']
    );
    // Table RLS does not constrain independent PostgreSQL sequences.
    const publicSequenceRows = await client.query(
      `SELECT c.relname AS sequence_name,
              has_sequence_privilege('anon', c.oid, 'SELECT,USAGE,UPDATE') AS anon_can_access,
              has_sequence_privilege('authenticated', c.oid, 'SELECT,USAGE,UPDATE') AS authenticated_can_access
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind='S'`
    );
    // Views and RPC routines are not covered by ordinary relkind r/p RLS.
    // Inspect catalog metadata only; do not execute any view or routine.
    const publicViewRows = await client.query(
      `SELECT c.relname AS object_name, c.relkind,
              (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
               OR has_any_column_privilege('anon', c.oid,
                    'SELECT,INSERT,UPDATE,REFERENCES')) AS anon_can_access,
              (has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
               OR has_any_column_privilege('authenticated', c.oid,
                    'SELECT,INSERT,UPDATE,REFERENCES')) AS authenticated_can_access
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind IN ('v','m','f')`
    );
    const publicRoutineRows = await client.query(
      `SELECT p.oid::regprocedure::text AS routine_name,
              p.prosecdef AS security_definer,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
              has_function_privilege('authenticated', p.oid, 'EXECUTE')
                AS authenticated_can_execute
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public'`
    );
    const columnRows = await client.query(
      `SELECT c.relname AS table_name, a.attname AS column_name,
              t.typname AS udt_name,
              CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
              pg_get_expr(d.adbin,d.adrelid) AS column_default
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
         JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
         JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
         LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
         WHERE n.nspname = $1 AND c.relkind IN ('r','p') AND c.relname = ANY($2::text[])`,
      ['public', [...new Set(CIVIC_RUNTIME_COLUMNS.map(([table]) => table))]]
    );
    const guard = await client.query(
      'SELECT blocked FROM public.civic_push_delivery_guard WHERE id = 1'
    );
    const schema = evaluateSchema(tables.rows.map(row => row.table_name));
    const civicProtection = evaluateCivicProtection(protectionRows.rows);
    const allPublicTables = evaluateAllPublicStagingTables(protectionRows.rows);
    const publicSequenceProtection = evaluatePublicSequenceProtection(publicSequenceRows.rows);
    const publicViewExposure = evaluatePublicViewExposure(publicViewRows.rows);
    const publicRoutineExposure = evaluatePublicRoutineExposure(publicRoutineRows.rows);
    const civicColumns = evaluateCivicRuntimeColumns(columnRows.rows);
    const deliveryBlocked = evaluateBlockedGuard(guard.rows);
    await client.query('ROLLBACK');
    return { ...schema, ready: schema.ready && civicProtection.ready &&
      allPublicTables.ready && publicSequenceProtection.ready &&
      publicViewExposure.ready && publicRoutineExposure.ready &&
      civicColumns.ready && deliveryBlocked,
      civicProtection, allPublicTables, publicSequenceProtection,
      publicViewExposure, publicRoutineExposure, civicColumns, deliveryBlocked };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run().then(result => {
    console.log(JSON.stringify({status: result.ready ? 'minimum_schema_protected_not_app_ready' : 'schema_or_civic_security_incomplete', appReady: false, ...result}));
    if (!result.ready) process.exitCode = 2;
  }).catch(() => {
    // Provider errors may contain server names, connection strings, or tokens.
    console.error('Unified staging preflight unavailable; operator review required');
    process.exitCode = 1;
  });
}

module.exports = {STAGING_REF, STAGING_PREFLIGHT_ROLE, STAGING_IDENTITY_HASH, REQUIRED_TABLES, CIVIC_PRIVATE_TABLES, CIVIC_RUNTIME_COLUMNS,
  assertStagingTarget, evaluateSchema, evaluateCivicProtection, evaluateAllPublicStagingTables,
  evaluatePublicSequenceProtection, evaluatePublicViewExposure,
  evaluatePublicRoutineExposure, evaluateCivicRuntimeColumns, evaluateBlockedGuard, evaluateStagingIdentity,
  evaluatePreflightRole, evaluatePreflightWriteGrants, evaluatePreflightReadGrants,
  evaluatePreflightPolicies, run};
