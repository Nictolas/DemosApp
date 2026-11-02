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
]);
// Core staging tables deny direct client access, regardless of any broad Data API defaults.
const CIVIC_PRIVATE_TABLES = Object.freeze([
  'notifiche_preferenze', 'user_devices', 'civic_new_initiative_notifications',
  'civic_push_delivery_guard', 'civic_runtime_identity',
  'user_profile', 'notifiche_demos', 'iniziative_popolari', 'referendum_abrogativi',
  'active_sessions', 'ice', 'comunicazioni', 'unita_elettorale', 'candidati',
  'political_candidacies', 'political_mandates', 'parlamento', 'votazioni_parlamento',
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
  const set = new Set(present);
  const missing = required.filter(name => !set.has(name));
  return {ready: missing.length === 0, presentCount: required.length - missing.length, requiredCount: required.length, missing};
}

function evaluateCivicProtection(rows, required = CIVIC_PRIVATE_TABLES) {
  const byName = new Map(rows.map(row => [row.table_name, row]));
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
  const indexed = new Map(rows.map(row => [row.table_name + '.' + row.column_name, row]));
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
  return Array.isArray(rows) && rows.length === 1 && rows[0].blocked === true;
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
    const tables = await client.query(
      `SELECT c.relname AS table_name FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relkind IN ('r','p') AND c.relname = ANY($2::text[])`,
      ['public', [...REQUIRED_TABLES]]
    );
    // Metadata-only authorization audit; this does not read any account or
    // notification row. A missing table, disabled RLS, or any direct client
    // grant must fail the preflight even when all nine core tables exist.
    const protectionRows = await client.query(
      `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
              has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_can_access,
              has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_can_access
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relkind IN ('r', 'p')
           AND c.relname = ANY($2::text[])`,
      ['public', [...CIVIC_PRIVATE_TABLES]]
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
    const civicColumns = evaluateCivicRuntimeColumns(columnRows.rows);
    const deliveryBlocked = evaluateBlockedGuard(guard.rows);
    await client.query('ROLLBACK');
    return { ...schema, ready: schema.ready && civicProtection.ready &&
      civicColumns.ready && deliveryBlocked, civicProtection, civicColumns, deliveryBlocked };
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
  assertStagingTarget, evaluateSchema, evaluateCivicProtection,
  evaluateCivicRuntimeColumns, evaluateBlockedGuard, evaluateStagingIdentity, run};
