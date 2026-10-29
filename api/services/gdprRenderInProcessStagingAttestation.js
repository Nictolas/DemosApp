'use strict';

// Opt-in, one-shot, SELECT-only evidence from a canonical pool connection in
// an already-running Render STAGING backend process. NO HTTP route.
// Draft-only: do not turn on any Render setting or deploy without approval.
// This is a single pooled session, NOT an exhaustive inventory or a GO gate.
const {assertStagingTarget, publicReport, SQL} =
  require('../scripts/attest-gdpr-writer-readonly');

const ENV_MARKER = 'demos-staging-inprocess-readonly-20261029';
const STAGING_SERVICE_ID = 'srv-db52l1g473hc739ld250';
const LOG_PREFIX = 'GDPR_RENDER_STAGING_POOL_IDENTITY ';
const BAD_CONFIG = 'NO_GO_STAGING_ATTESTATION_GUARD_FAILED';

function assertProcessTarget(env) {
  if (env?.GDPR_RENDER_INPROCESS_ATTESTATION !== ENV_MARKER ||
      env.RENDER !== 'true' ||
      env.RENDER_SERVICE_ID !== STAGING_SERVICE_ID ||
      env.NODE_ENV !== 'production') {
    throw Error(BAD_CONFIG);
  }
  // Validate the *actual* configured staging DB URL, never a user-supplied
  // endpoint or an arbitrary SQL role. This also requires the independent
  // operator marker and forbids production project / insecure sslmode.
  try { assertStagingTarget(env); }
  catch (_) { throw Error(BAD_CONFIG); }
  return {service:'demos-functional-staging',project:'Demos-Staging'};
}

function safeErrorReport() {
  return Object.freeze({
    service:'demos-functional-staging',
    project:'Demos-Staging',
    in_process_staging_session_observed:false,
    live_production_pool_verified:false,
    recoveryReady:false,
    status:'NO_GO_STAGING_ATTESTATION_NOT_PROVEN'
  });
}

async function attestInProcess({env, getPool, emit}) {
  // Guard before obtaining a client: no import or query of any production
  // service if a flag is mistakenly enabled there.
  try { assertProcessTarget(env); }
  catch (_) {
    const report=safeErrorReport();
    emit?.(LOG_PREFIX+JSON.stringify(report));
    return report;
  }
  let client;
  try {
    // Must be injected from server.js in the SAME Node process and exact
    // canonical pool module used by regular authenticated requests.
    const pool=getPool();
    client=await pool.connect();
    const result=await client.query({
      text:SQL,rowMode:'object',query_timeout:5000
    });
    const report={
      ...publicReport(result.rows),
      service:'demos-functional-staging',
      in_process_staging_session_observed:true,
      live_production_pool_verified:false,
      recoveryReady:false,
      scope:'ONE_CANONICAL_POOL_SESSION_NOT_ALL_CONNECTIONS'
    };
    emit?.(LOG_PREFIX+JSON.stringify(report));
    return report;
  }catch(_){
    // Never log an exception, stack, connection string, SQL values or token.
    const report=safeErrorReport();
    emit?.(LOG_PREFIX+JSON.stringify(report));
    return report;
  }finally{
    if(client)try{client.release();}catch(_){}
  }
}

module.exports=Object.freeze({
  attestInProcess,assertProcessTarget,LOG_PREFIX,STAGING_SERVICE_ID
});
