'use strict';

// OPS-STG-001: standalone, read-only database source canary.
// Intentionally NEVER imports api/server.js, api/app.js, Firebase or cron jobs.
const http = require('node:http');
const {assertStagingAppCanary} = require('./unified_staging_app_safety');
const {verifyCivicStagingRuntimeIdentity} =
  require('../services/civicStagingSessionRuntimeIdentity');

const SOURCE_QUERIES = Object.freeze([
  'SELECT id, title, status FROM public.eci LIMIT 0',
  'SELECT id, id_ministero, titolo, tipo, stato FROM public.iniziative_ministero LIMIT 0',
  'SELECT id, nome FROM public.iniziative_popolari LIMIT 0',
  'SELECT id, nome FROM public.referendum_abrogativi LIMIT 0',
]);

function checkedPort(env) {
  const value = String(env.PORT === undefined ? '10000' : env.PORT);
  if (!/^[1-9][0-9]{0,4}$/.test(value) ||
      Number(value) > 65535) throw new Error('STAGING_CIVIC_CANARY_INVALID_PORT');
  return Number(value);
}

// A single transaction is explicitly READ ONLY regardless of session defaults.
// No row content is read, logged, transmitted or returned to the HTTP caller.
// LIMIT 0 still checks columns, table SELECT rights and SQL query validity.
async function probeCivicSourceSchema(pool) {
  let client;
  let inTransaction = false;
  let discard = false;
  try {
    if (!pool || typeof pool.connect !== 'function')
      throw new Error('pool');
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    inTransaction = true;
    const settings = await client.query(
      "SELECT current_setting('transaction_read_only')::text AS read_only");
    if (settings?.rows?.length !== 1 || settings.rows[0].read_only !== 'on')
      throw new Error('read_only_disabled');
    for (const sql of SOURCE_QUERIES) await client.query(sql);
    await client.query('ROLLBACK');
    inTransaction = false;
    return true;
  } catch {
    discard = true;
    if (client && inTransaction) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    throw new Error('STAGING_CIVIC_SOURCE_SCHEMA_UNAVAILABLE');
  } finally {
    if (client) {
      try { client.release(discard); } catch {}
    }
  }
}

function respond(req, res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  if (req.method === 'HEAD') return res.end();
  res.end(JSON.stringify(payload));
}

function createCivicReadOnlyServer({sourceProbe, now=Date.now}={}) {
  if (typeof sourceProbe !== 'function') throw new Error('SOURCE_PROBE_REQUIRED');
  // Coalesce simultaneous probes and cache only successful checks for 15s,
  // preventing repeated unauthenticated callers from saturating PG Free.
  let inFlight = null;
  let healthyUntil = 0;
  const probe = async () => {
    if (now() < healthyUntil) return true;
    if (!inFlight) {
      inFlight = Promise.resolve().then(sourceProbe).then(result => {
        if (result !== true) return false;
        healthyUntil = now() + 15000;
        return true;
      }).catch(() => false).finally(() => { inFlight = null; });
    }
    return inFlight;
  };
  return http.createServer((req, res) => {
    const path = req.url;
    // Exact request target matching: no URL normalization, traversal, query,
    // arbitrary host, trailing slash or encoded route variants.
    if (!['GET','HEAD'].includes(req.method) || typeof path !== 'string')
      return respond(req,res,404,{error:'not_found'});
    if (path === '/health' || path === '/health/live') {
      return respond(req,res,200,{status:'source_canary_only',
        app_ready:false, notifications_enabled:false});
    }
    if (path === '/health/ready') {
      return respond(req,res,503,{status:'not_ready',
        reason:'application_and_android_e2e_not_authorized'});
    }
    if (path === '/health/civic-sources') {
      void probe().then(healthy => {
        respond(req,res,healthy?200:503, {
          status:healthy?'read_only_source_schema_passed':'source_schema_unavailable',
          app_ready:false, notifications_enabled:false,
        });
      }).catch(() => {
        respond(req,res,503,{status:'source_schema_unavailable',
          app_ready:false,notifications_enabled:false});
      });
      return;
    }
    return respond(req,res,404,{error:'not_found'});
  });
}

async function startCivicReadOnlyCanary(env=process.env, {
  createPool,
  verifyIdentity=verifyCivicStagingRuntimeIdentity,
  sourceProbe=probeCivicSourceSchema,
}={}) {
  // Fail closed BEFORE importing pg, opening sockets, or loading provider CA.
  const {connectionString,active} = assertStagingAppCanary(env);
  if (!active) throw new Error('STAGING_CIVIC_CANARY_STAGING_ONLY');
  const port = checkedPort(env);
  const fs=require('node:fs'),path=require('node:path');
  const {buildDatabaseSsl}=require('../utils/databaseTlsPolicy');
  const ca=fs.readFileSync(
    path.join(__dirname,'..','certs','prod-ca-2021.crt'),'utf8');
  const options={
    connectionString,max:2,min:0,connectionTimeoutMillis:7000,
    query_timeout:7000,statement_timeout:7000,idleTimeoutMillis:3000,
    application_name:'demos_staging_civic_readonly_canary',
    options:'-c default_transaction_read_only=on',
    ssl:buildDatabaseSsl(connectionString,{supabaseCa:ca}),
  };
  const pool=createPool?createPool(options):new (require('pg').Pool)(options);
  let server;
  try {
    if (!pool || typeof pool.connect!=='function' ||
        typeof pool.end!=='function') throw new Error('pool_invalid');
    if (await verifyIdentity(pool) !== true) throw new Error('identity_failed');
    if (await sourceProbe(pool) !== true) throw new Error('schema_failed');
    server=createCivicReadOnlyServer({sourceProbe:()=>sourceProbe(pool)});
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(port,'0.0.0.0',resolve);
    });
    return {server,pool};
  } catch {
    if (server?.listening) await new Promise(resolve=>server.close(resolve));
    if (pool && typeof pool.end==='function') await pool.end().catch(()=>{});
    throw new Error('STAGING_CIVIC_CANARY_NOT_READY');
  }
}

if (require.main === module) {
  startCivicReadOnlyCanary().then(()=>{
    console.info('[unified-staging] isolated source canary; app and FCM disabled');
  }).catch(()=>{
    // No provider/credential error details reach logs.
    console.error('STAGING_CIVIC_CANARY_NOT_READY');
    process.exitCode=1;
  });
}

module.exports={SOURCE_QUERIES,checkedPort,probeCivicSourceSchema,
  createCivicReadOnlyServer,startCivicReadOnlyCanary};
