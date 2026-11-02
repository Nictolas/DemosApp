'use strict';

// Read-only Supabase staging preflight. Nothing is written to the database.
const {Client} = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const {buildDatabaseSsl} = require('../utils/databaseTlsPolicy');

const STAGING_REF = 'fkeayjzvtuvzesljhjbc';
const REQUIRED_TABLES = Object.freeze([
  'users', 'user_consents', 'opinioni_risposte', 'notifiche_preferenze',
  'eventi', 'programmi', 'civic_processes', 'iniziative_ministero', 'eci',
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
  const isDirect = host === `db.${STAGING_REF}.supabase.co` && username === 'postgres' && (url.port === '' || url.port === '5432');
  const isPooler = host.endsWith('.pooler.supabase.com') && username === `postgres.${STAGING_REF}` && ['5432', '6543'].includes(url.port);
  if (!isDirect && !isPooler) throw new Error('Refusing non-staging Supabase project or endpoint');
  // SSL configuration must come from verified databaseTlsPolicy, not URL options.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslaccept']) url.searchParams.delete(key);
  return {sanitizedConnectionString: url.toString(), target: 'Demos-Staging'};
}

function evaluateSchema(present, required = REQUIRED_TABLES) {
  const set = new Set(present);
  const missing = required.filter(name => !set.has(name));
  return {ready: missing.length === 0, presentCount: required.length - missing.length, requiredCount: required.length, missing};
}

async function run(env = process.env) {
  // The shared staging service is still in bootstrap. Target validation alone
  // does not authorize even a read-only network connection to Demos-Staging.
  // A separate, explicit operator GO must be granted after consolidation.
  if (env.DEMOS_UNIFIED_STAGING_PREFLIGHT_GO !== 'APPROVED_READ_ONLY_PREFLIGHT') {
    throw new Error('Unified staging preflight not authorized while bootstrap is incomplete');
  }
  const {sanitizedConnectionString} = assertStagingTarget(env.DATABASE_URL, env);
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
    const tables = await client.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = $2 AND table_name = ANY($3::text[])',
      ['public', 'BASE TABLE', [...REQUIRED_TABLES]]
    );
    const result = evaluateSchema(tables.rows.map(row => row.table_name));
    await client.query('ROLLBACK');
    return result;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run().then(result => {
    console.log(JSON.stringify({status: result.ready ? 'schema_ready' : 'schema_incomplete', ...result}));
    if (!result.ready) process.exitCode = 2;
  }).catch(error => {
    console.error('Unified staging preflight blocked: ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = {STAGING_REF, REQUIRED_TABLES, assertStagingTarget, evaluateSchema, run};
