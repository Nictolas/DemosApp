'use strict';

// OPS-STG-001/T-55. This mode is entirely separate from the bootstrap and app.
// It checks ONLY the dedicated staging read-only credential, then exposes
// liveness and audit status. Readiness ALWAYS stays 503, so no app or push can
// treat this process as authorized for operational use.
const http = require('node:http');
const {assertStagingTarget, run} = require('../scripts/unifiedStagingPreflight');

const MUST_BE_DISABLED = Object.freeze([
  'CIVIC_PUSH_ENABLED',
  'CIVIC_NEW_INITIATIVE_EVENTS_ENABLED',
  'CIVIC_NEW_INITIATIVE_PUSH_ENABLED',
  'ENABLE_MINISTERO_SYNC',
  'ENABLE_CIVIC_PROCESS_SYNC',
  'DEMOS_STAGING_ANDROID_PUSH_E2E',
  'ALLOW_DEMOS_STAGING_MIGRATIONS',
]);
const FORBIDDEN_CREDENTIALS = Object.freeze([
  'DATABASE_URL', 'DIRECT_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'PGHOST', 'PGUSER', 'PGPASSWORD', 'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS',
  'REDIS_URL',
]);

function validatePreflightEnvironment(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env) ||
      env.NODE_ENV !== 'staging' || env.DEMOS_UNIFIED_STAGING_MODE !== 'preflight' ||
      env.DEMOS_UNIFIED_STAGING_PREFLIGHT_GO !== 'APPROVED_READ_ONLY_PREFLIGHT') {
    throw new Error('STAGING_PREFLIGHT_MODE_NOT_AUTHORIZED');
  }
  for (const name of MUST_BE_DISABLED) {
    if (env[name] !== 'false') throw new Error('STAGING_PREFLIGHT_FLAGS_MUST_BE_OFF');
  }
  for (const name of FORBIDDEN_CREDENTIALS) {
    if (env[name] != null && String(env[name]).trim() !== '') {
      throw new Error('STAGING_PREFLIGHT_PROVIDER_CREDENTIALS_FORBIDDEN');
    }
  }
  // The only permitted secret is a distinct least-privilege read-only
  // role. Require the exact IPv4 session pooler host copied from Supabase
  // Connect (never infer aws-N from a region), rather than the direct IPv6 DB.
  assertStagingTarget(env.STAGING_PREFLIGHT_DATABASE_URL, env);
  const expectedHost=env.STAGING_PREFLIGHT_EXPECTED_POOLER_HOST;
  if (typeof expectedHost !== 'string' ||
      !/^aws-[0-9]+-eu-central-1\\.pooler\\.supabase\\.com$/.test(expectedHost)) {
    throw new Error('STAGING_PREFLIGHT_EXACT_POOLER_HOST_REQUIRED');
  }
  let url;
  try { url=new URL(env.STAGING_PREFLIGHT_DATABASE_URL); }
  catch { throw new Error('STAGING_PREFLIGHT_ENDPOINT_INVALID'); }
  if (url.hostname.toLowerCase()!==expectedHost ||
      url.port!=='5432') {
    throw new Error('STAGING_PREFLIGHT_SESSION_POOLER_REQUIRED');
  }
  const raw = env.PORT === undefined ? '10000' : String(env.PORT);
  if (!/^[1-9][0-9]{0,4}$/.test(raw) || Number(raw)>65535) {
    throw new Error('STAGING_PREFLIGHT_INVALID_PORT');
  }
  return {port:Number(raw)};
}

function reply(res, status, data) {
  res.writeHead(status, {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'x-frame-options':'DENY',
  });
  res.end(JSON.stringify(data));
}

function createPreflightServer() {
  return http.createServer((req,res) => {
    if (req.method !== 'GET') {
      return reply(res,405,{error:'method_not_allowed'});
    }
    if (typeof req.url !== 'string' || !req.url.startsWith('/') ||
        req.url.startsWith('//')) {
      return reply(res,400,{error:'invalid_request_target'});
    }
    let route;
    try {
      route=new URL(req.url,'http://localhost').pathname;
    } catch {
      return reply(res,400,{error:'invalid_request_target'});
    }
    if (route==='/health' || route==='/health/live') {
      return reply(res,200,{status:'preflight_only',
        app_ready:false, notifications_enabled:false});
    }
    if (route==='/health/preflight') {
      return reply(res,200,{status:'read_only_preflight_passed',
        app_ready:false, notifications_enabled:false,
        session_affinity_verified:false});
    }
    if (route==='/health/ready') {
      return reply(res,503,{status:'not_ready',
        reason:'application_and_android_e2e_not_authorized'});
    }
    return reply(res,404,{error:'not_found'});
  });
}

async function startPreflightServer(env=process.env, {runPreflight=run}={}) {
  const {port}=validatePreflightEnvironment(env); // no network before gate
  const result=await runPreflight(env); // read-only staging DB, no app imports
  if (!result || result.ready!==true || result.deliveryBlocked!==true) {
    throw new Error('STAGING_PREFLIGHT_AUDIT_NOT_READY');
  }
  const server=createPreflightServer();
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'0.0.0.0',resolve);
  });
  return server;
}

if (require.main===module) {
  startPreflightServer().then(()=>{
    console.info('[unified-staging] isolated read-only preflight; app disabled');
  }).catch(()=>{
    // Never print driver errors, connection URLs, hostnames, usernames or tokens.
    console.error('STAGING_PREFLIGHT_UNAVAILABLE');
    process.exitCode=1;
  });
}

module.exports={validatePreflightEnvironment,createPreflightServer,startPreflightServer};
