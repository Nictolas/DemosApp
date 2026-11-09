'use strict';

// DEMOS 6: contract-only staging probe. It never starts the production API,
// creates a DB pool, initializes Firebase messaging, or handles user data.
const http = require('node:http');

const PATHS = Object.freeze({
  iniziative_popolari: '/iniziative-popolari',
  referendum_abrogativi: '/referendum-abrogativi',
  eci: '/eci',
});
const ACTIVE_FLAGS = Object.freeze([
  'CIVIC_PUSH_ENABLED', 'CIVIC_NEW_INITIATIVE_EVENTS_ENABLED',
  'CIVIC_NEW_INITIATIVE_PUSH_ENABLED', 'ENABLE_MINISTERO_SYNC',
  'ENABLE_CIVIC_PROCESS_SYNC', 'DEMOS_STAGING_ANDROID_PUSH_E2E',
  'ALLOW_DEMOS_STAGING_MIGRATIONS',
  'PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED', 'PARLIAMENT_FINAL_PUSH_ENABLED',
]);
const SECRETS = Object.freeze([
  'DATABASE_URL', 'DIRECT_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD',
  'CIVIC_STAGING_SESSION_DATABASE_URL', 'STAGING_PREFLIGHT_DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL',
  'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_SERVICE_ACCOUNT_JSON', 'CIVIC_PUSH_DISPATCH_KEY',
  'CIVIC_MINISTERO_SYNC_KEY', 'REDIS_URL',
]);
const enabled = value => ['true','1','yes','on']
  .includes(String(value ?? '').toLowerCase().trim());

function assertCanaryEnvironment(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env) ||
      env.NODE_ENV !== 'staging' || env.CIVIC_D6_CONTRACT_ONLY !== 'true') {
    throw new Error('D6_CANARY_REQUIRES_STAGING_OPT_IN');
  }
  if (ACTIVE_FLAGS.some(key => enabled(env[key])) ||
      SECRETS.some(key => String(env[key] ?? '').trim() !== '')) {
    throw new Error('D6_CANARY_EXTERNAL_SIDE_EFFECTS_FORBIDDEN');
  }
  return true;
}

function verifyPayloads(buildCivicPush) {
  if (typeof buildCivicPush !== 'function') throw new Error('D6_BUILDER_MISSING');
  for (const [i, category] of Object.keys(PATHS).entries()) {
    const officialId = category === 'eci' ? '2026-000011' : '9990001';
    const payload = buildCivicPush({
      id: i + 1, category, official_id: officialId, title: 'Synthetic QA event',
    });
    const link = payload?.data?.link;
    const target = new URL(link || 'about:blank');
    if (target.origin !== 'https://www.demos.community' ||
        target.pathname !== PATHS[category] ||
        target.searchParams.get('initiative') !== officialId ||
        payload?.data?.category !== category ||
        payload?.data?.type !== 'civic_new_initiative' ||
        payload?.data?.official_id !== officialId ||
        !payload?.topic ||
        payload?.notification?.body !== 'Synthetic QA event' ||
        payload?.android?.ttl !== 3600000 ||
        payload?.webpush?.fcmOptions?.link !== link) {
      throw new Error('D6_CIVIC_PAYLOAD_CONTRACT_FAILED');
    }
  }
  return true;
}

function createServer(env, { builder } = {}) {
  assertCanaryEnvironment(env);
  if (verifyPayloads(builder) !== true) throw new Error('D6_CONTRACTS_FAILED');
  return http.createServer((req,res)=>{
    res.setHeader('content-type','application/json; charset=utf-8');
    res.setHeader('cache-control','no-store');
    res.setHeader('x-content-type-options','nosniff');
    if (!['GET','HEAD'].includes(req.method) ||
        !['/health','/health/contracts'].includes(req.url)) {
      res.writeHead(404);
      return res.end(req.method === 'HEAD' ? undefined : '{"error":"not_found"}');
    }
    res.writeHead(200);
    const body = req.url === '/health'
      ? { status:'civic_d6_contract_canary',app_ready:false,
          database_connected:false,notifications_enabled:false }
      : { status:'synthetic_contracts_passed',categories_verified:3,
          db_reads:0,fcm_sends:0,release_ready:false };
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
  });
}

function start(env=process.env) {
  assertCanaryEnvironment(env);
  const raw = String(env.PORT || '10000');
  if (!/^[1-9][0-9]{0,4}$/.test(raw) || Number(raw) > 65535) {
    throw new Error('D6_CANARY_INVALID_PORT');
  }
  const {buildCivicPush}=require('../services/civicNewInitiativePushDispatcher');
  const server=createServer(env,{builder:buildCivicPush});
  server.listen(Number(raw),'0.0.0.0',()=>{
    console.info('D6_CIVIC_CONTRACT_CANARY_READY_DB_OFF_FCM_OFF');
  });
  return server;
}

if (require.main === module) {
  try { start(); } catch {
    console.error('D6_CIVIC_CONTRACT_CANARY_NOT_READY');
    process.exitCode=1;
  }
}
module.exports={assertCanaryEnvironment,verifyPayloads,createServer,start};
