'use strict';

// Isolated one-shot T-55 runtime-role audit. No DEMOS app/Firebase imports.
// Staging ONLY, database tables READ ONLY; advisory locks are temporary and
// released before the connection is discarded. Never log URLs, credentials,
// PIDs, identities or driver errors.
const fs=require('node:fs');
const path=require('node:path');
const {randomInt}=require('node:crypto');
const {buildDatabaseSsl}=require('../utils/databaseTlsPolicy');
const {assertCivicStagingSessionEndpoint,
  resolveCivicStagingSessionConnectionString}=
  require('../services/civicStagingSessionEndpointSafety');
const {verifyCivicStagingRuntimeIdentity}=
  require('../services/civicStagingSessionRuntimeIdentity');
const {observeReadOnlySessionContinuity}=
  require('../scripts/unifiedStagingSessionContinuity');

const REF='fkeayjzvtuvzesljhjbc';
const HOST='aws-1-eu-central-1.pooler.supabase.com';
const APPROVAL='APPROVED_ISOLATED_STAGING_RUNTIME_LOCK_TEST';
const OFF=[
  'CIVIC_PUSH_ENABLED','CIVIC_NEW_INITIATIVE_EVENTS_ENABLED',
  'CIVIC_NEW_INITIATIVE_PUSH_ENABLED','ENABLE_MINISTERO_SYNC',
  'ENABLE_CIVIC_PROCESS_SYNC','DEMOS_STAGING_ANDROID_PUSH_E2E',
  'ALLOW_DEMOS_STAGING_MIGRATIONS',
];
function assertRuntimeAuditAllowed(env) {
  if (!env || env.NODE_ENV!=='staging' ||
      env.DEMOS_UNIFIED_STAGING_MODE!=='preflight' ||
      env.DEMOS_UNIFIED_STAGING_PREFLIGHT_GO!=='APPROVED_READ_ONLY_PREFLIGHT' ||
      env.CIVIC_STAGING_RUNTIME_AUDIT_GO!==APPROVAL ||
      OFF.some(key=>env[key]!=='false') ||
      ['CIVIC_UNIFIED_STAGING_READY',
        'CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED',
        'CIVIC_STAGING_SESSION_CHECK_APPLY'
      ].some(key=>env[key]==='true')) {
    throw new Error('STAGING_RUNTIME_AUDIT_NOT_AUTHORIZED');
  }
  assertCivicStagingSessionEndpoint({
    connectionString:resolveCivicStagingSessionConnectionString(
      env.CIVIC_STAGING_SESSION_DATABASE_URL),
    projectRef:REF,
    expectedPoolerHost:HOST,
    env,
  });
}

async function runIsolatedRuntimeLockAudit(env, {createPool}={}) {
  // Validation before importing pg, opening any socket or reading the CA.
  assertRuntimeAuditAllowed(env);
  const connectionString=resolveCivicStagingSessionConnectionString(
    env.CIVIC_STAGING_SESSION_DATABASE_URL);
  const ca=fs.readFileSync(path.join(__dirname,'..','certs','prod-ca-2021.crt'),'utf8');
  const options={
    connectionString,max:2,min:0,connectionTimeoutMillis:7000,
    query_timeout:7000,idleTimeoutMillis:1000,
    ssl:buildDatabaseSsl(connectionString,{supabaseCa:ca}),
    application_name:'demos_staging_runtime_lock_audit',
  };
  const pool=createPool?createPool(options):new (require('pg').Pool)(options);
  if(!pool || typeof pool.connect!=='function' || typeof pool.end!=='function')
    throw new Error('STAGING_RUNTIME_POOL_INVALID');
  const held=[];
  try {
    // Classify authentication/transport failures WITHOUT returning a provider
    // message or connection URL. Connection is discarded after the check.
    let loginClient;
    try {
      loginClient=await pool.connect();
    } catch(error) {
      if (['28P01','28000'].includes(error?.code))
        throw new Error('STAGING_RUNTIME_PASSWORD_REJECTED');
      if (['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ETIMEDOUT',
           'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
           'CERT_HAS_EXPIRED','SELF_SIGNED_CERT_IN_CHAIN'].includes(error?.code))
        throw new Error('STAGING_RUNTIME_TRANSPORT_REJECTED');
      throw new Error('STAGING_RUNTIME_LOGIN_UNVERIFIED');
    } finally {
      if (loginClient) loginClient.release(true);
    }
    await verifyCivicStagingRuntimeIdentity(pool);

    const first=await pool.connect();held.push(first);
    const second=await pool.connect();held.push(second);
    for(const client of held) {
      const result=await client.query(
        "SELECT current_user::text AS role_name, current_database()::text AS db");
      if(result?.rows?.length!==1 ||
         result.rows[0].role_name!=='demos_staging_runtime' ||
         result.rows[0].db!=='postgres') throw new Error('STAGING_ROLE_MISMATCH');
    }
    for(const client of held) {
      const observed=await observeReadOnlySessionContinuity(client);
      if(observed!==true) throw new Error('STAGING_RUNTIME_SESSION_NOT_STABLE');
    }
    // Namespace reserved for this ephemeral audit, random second key to avoid
    // colliding with application locks. No SQL table writes or data mutation.
    const namespace=159823041, key=randomInt(1,2147483647);
    const acquire=async client=>{
      const r=await client.query(
        'SELECT pg_try_advisory_lock($1::int,$2::int) AS acquired',
        [namespace,key]);
      return r?.rows?.[0]?.acquired;
    };
    const release=async client=>{
      const r=await client.query(
        'SELECT pg_advisory_unlock($1::int,$2::int) AS released',
        [namespace,key]);
      return r?.rows?.[0]?.released;
    };
    if(await acquire(first)!==true) throw new Error('STAGING_LOCK_FIRST_REJECTED');
    if(await acquire(second)!==false) throw new Error('STAGING_LOCK_NOT_EXCLUSIVE');
    await first.query('BEGIN READ ONLY');
    await first.query('ROLLBACK');
    if(await acquire(second)!==false) throw new Error('STAGING_LOCK_NOT_PERSISTENT');
    if(await release(first)!==true) throw new Error('STAGING_LOCK_RELEASE_FAILED');
    if(await acquire(second)!==true) throw new Error('STAGING_LOCK_REACQUIRE_FAILED');
    if(await release(second)!==true) throw new Error('STAGING_LOCK_SECOND_RELEASE_FAILED');
    return true;
  } finally {
    // Close every session whether the test passed or failed. Never reuse
    // a connection with uncertain state or an accidentally held lock.
    for(const client of held) {
      try {await client.query('ROLLBACK');} catch {}
      try {await client.query('SELECT pg_advisory_unlock_all()');} catch {}
      try {client.release(true);} catch {}
    }
    await pool.end().catch(()=>{});
  }
}

function classifyRuntimeAuditFailure(error) {
  // Fixed-code taxonomy only; never serialize original provider errors.
  const code=error?.message;
  if (code==='STAGING_RUNTIME_AUDIT_NOT_AUTHORIZED')
    return 'STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED_GATE';
  if (typeof code==='string' && code.startsWith('CIVIC_STAGING_SESSION_') &&
      code!=='CIVIC_STAGING_SESSION_RUNTIME_IDENTITY_UNVERIFIED')
    return 'STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED_ENDPOINT';
  if (code==='STAGING_RUNTIME_PASSWORD_REJECTED')
    return 'STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED_AUTH';
  if (code==='STAGING_RUNTIME_TRANSPORT_REJECTED')
    return 'STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED_TLS_NETWORK';
  if (code==='CIVIC_STAGING_SESSION_RUNTIME_IDENTITY_UNVERIFIED')
    return 'STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED_IDENTITY';
  if (typeof code==='string' && (code.startsWith('STAGING_LOCK_') ||
      code==='STAGING_RUNTIME_SESSION_NOT_STABLE' ||
      code==='STAGING_ROLE_MISMATCH'))
    return 'STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED_SESSION_LOCK';
  return 'STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED_UNAVAILABLE';
}
module.exports={assertRuntimeAuditAllowed,runIsolatedRuntimeLockAudit,
  classifyRuntimeAuditFailure,APPROVAL};
