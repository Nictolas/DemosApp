'use strict';

// Shared strict staging target guard and synthetic legacy helper.
// The earlier after-listening in-process probe is DISABLED: server.js no
// longer imports this helper and index.js forbids all probe flags on web boot.
// Real-world role observations, if separately authorized, must use the
// isolated one-shot CLI. No HTTP endpoint or GO gate exists.
const {assertStagingTarget, publicReport, SQL} =
  require('../scripts/attest-gdpr-writer-readonly');

const ENV_MARKER = 'demos-staging-inprocess-readonly-20261029';
const STAGING_SERVICE_ID = 'srv-db52l1g473hc739ld250';
const LOG_PREFIX = 'GDPR_RENDER_STAGING_POOL_IDENTITY ';
const BAD_CONFIG = 'NO_GO_STAGING_ATTESTATION_GUARD_FAILED';

// Existing functional-staging branch has one migration boot path and several
// opt-in E2E writers. The identity probe is READONLY and cannot run alongside
// any of these write-capable modes. This is a bounded, explicit inventory;
// other jobs and external provider identities still require separate review.
const MUTATING_STAGING_E2E_FLAGS = Object.freeze([
  'DEMOS_STAGING_AUTH_E2E',
  'DEMOS_STAGING_MUTATION_E2E',
  'DEMOS_STAGING_OPINION_NOTIFICATION_E2E',
  'DEMOS_STAGING_OPINION_PROPOSAL_E2E',
  'DEMOS_STAGING_PREFERENCE_COOLDOWN_E2E',
  'DEMOS_STAGING_POLITICAL_CONSENT_E2E',
  'DEMOS_STAGING_TRANSPARENCY_PODIUM_E2E',
  'DEMOS_STAGING_LOAD_E2E',
  'DEMOS_STAGING_ELECTORAL_PERIMETER_E2E'
]);

// Additional opt-in jobs in the actual staging app. Some write to SQL,
// external archives, or remote sources. Never run one alongside a claimed
// readonly identity-only attestation. This still cannot silence unconditional
// performance monitoring, Firebase initialization, or other provider access.
const STAGING_BACKGROUND_JOB_FLAGS = Object.freeze([
  'ENABLE_DATA_RETENTION',
  'ENABLE_VIOLATION_MONITORING',
  'ENABLE_AUTOMATIC_BACKUP',
  'ENABLE_MINISTERO_SYNC',
  'ENABLE_CIVIC_PROCESS_SYNC',
  'ENABLE_POLITICAL_TERRITORY_RESOLVER',
  'ENABLE_ITALIAN_ELECTION_UNIT_SYNC',
  'ENABLE_VOTI_PARLAMENTO_SYNC',
  'ENABLE_OPENPOLIS_COSA_SUCCEDE_SYNC',
  'AXIOM_ARCHIVE_ENABLED'
]);

function assertProcessTarget(env) {
  if (env?.GDPR_RENDER_INPROCESS_ATTESTATION !== ENV_MARKER ||
      env.RENDER !== 'true' ||
      env.RENDER_SERVICE_ID !== STAGING_SERVICE_ID ||
      env.NODE_ENV !== 'production') {
    throw Error(BAD_CONFIG);
  }
  // Staging's existing entrypoint can run DDL/seed before server import.
  // Forbid combining that boot workflow with a read-only SQL identity probe.
  if (env.DEMOS_STAGING_MIGRATION_MODE != null &&
      env.DEMOS_STAGING_MIGRATION_MODE !== '') {
    throw Error(BAD_CONFIG);
  }
  if (STAGING_BACKGROUND_JOB_FLAGS.some(key => env[key] === 'true')) {
    throw Error(BAD_CONFIG);
  }
  // Staging's existing server can launch E2E writers on its listening event.
  if (MUTATING_STAGING_E2E_FLAGS.some(key => env[key] === 'true')) {
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
  attestInProcess,assertProcessTarget,LOG_PREFIX,STAGING_SERVICE_ID,
  MUTATING_STAGING_E2E_FLAGS,STAGING_BACKGROUND_JOB_FLAGS
});
