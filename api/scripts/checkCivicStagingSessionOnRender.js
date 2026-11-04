'use strict';

// Standalone read-only diagnostic for an approved Render staging service.
// This script never imports the DEMOS API, Firebase or production DB pool.
// It never changes feature flags, takes advisory locks, reads account records
// or logs URLs, usernames, tokens, SQL backend PIDs or passwords.
const { assertCivicStagingSessionEndpoint,
  resolveCivicStagingSessionConnectionString } =
  require('../services/civicStagingSessionEndpointSafety');
const { probeCivicSessionAffinity } =
  require('../services/civicSessionAffinityProbe');
const { verifyCivicStagingRuntimeIdentity } =
  require('../services/civicStagingSessionRuntimeIdentity');

async function runCivicStagingSessionCheck(env = process.env, {
  createPool,
  runProbe = probeCivicSessionAffinity,
} = {}) {
  if (env.CIVIC_STAGING_SESSION_CHECK_APPLY !== 'true') {
    return {
      dryRun: true, result: 'NOT_TESTED', compatible: false,
      operatorReviewRequired: true,
    };
  }
  // Unified staging bootstrap is intentionally NO-GO. Both milestones must
  // be independently confirmed before any real PostgreSQL socket is opened.
  // This does not mutate or inspect Render/Supabase infrastructure.
  if (env.CIVIC_UNIFIED_STAGING_READY !== 'true' ||
      env.CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED !== 'true') {
    throw new Error('CIVIC_UNIFIED_STAGING_BOOTSTRAP_NOT_READY');
  }
  if (env.CIVIC_STAGING_SESSION_CHECK_CONFIRM !==
      'I_APPROVE_READONLY_CIVIC_STAGING_SESSION_CHECK' ||
      env.CIVIC_STAGING_SESSION_CHECK_ENV !== 'staging') {
    throw new Error('CIVIC_STAGING_SESSION_APPROVAL_REQUIRED');
  }

  const runtimeConnectionString=resolveCivicStagingSessionConnectionString(
    env.CIVIC_STAGING_SESSION_DATABASE_URL);
  assertCivicStagingSessionEndpoint({
    connectionString: runtimeConnectionString,
    projectRef: env.CIVIC_STAGING_PROJECT_REF,
    expectedPoolerHost: env.CIVIC_STAGING_EXPECTED_POOLER_HOST,
    env,
  });

  // No Pool (and no network access) is created until every independent
  // stage-only guard has passed.
  const factory = createPool || ((options) => {
    const { Pool } = require('pg');
    return new Pool(options);
  });
  const pool = factory({
    connectionString: runtimeConnectionString,
    max: 2,
    min: 0,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    query_timeout: 5000,
    application_name: 'demos_civic_staging_readonly_probe',
    ssl: { rejectUnauthorized: true },
  });
  if (!pool || typeof pool.connect !== 'function' ||
      typeof pool.end !== 'function') {
    throw new Error('CIVIC_STAGING_SESSION_POOL_INVALID');
  }
  try {
    // The role/database identity is verified on the ACTUAL authenticated
    // PostgreSQL connection, not inferred from a user-supplied URL. Failure
    // never advances to PID sampling or enables any push.
    await verifyCivicStagingRuntimeIdentity(pool);
    return await runProbe(pool, {
      apply: true, confirmed: true, environment: 'staging',
      databaseUrl: runtimeConnectionString,
      rounds: 6,
    });
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  runCivicStagingSessionCheck().then((result) => {
    // NOTE: an INCONCLUSIVE result is NOT approval to enable delivery.
    console.log('CIVIC_STAGING_SESSION_CHECK', JSON.stringify(result));
    if (result.result !== 'INCONCLUSIVE' && result.result !== 'NOT_TESTED') {
      process.exitCode = 1;
    }
  }).catch(() => {
    // Do not serialize the original error: drivers can include credentials.
    console.error('CIVIC_STAGING_SESSION_CHECK_UNAVAILABLE');
    process.exitCode = 1;
  });
}

module.exports = { runCivicStagingSessionCheck };
