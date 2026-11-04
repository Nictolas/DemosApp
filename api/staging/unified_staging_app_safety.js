'use strict';

// Staging-only guard. Does not connect to a database or import the app.
// No credentials, URLs or provider errors are ever included in exceptions.
const { DEMOS_STAGING_PROJECT_REF, assertCivicStagingSessionEndpoint,
  resolveCivicStagingSessionConnectionString } =
  require('../services/civicStagingSessionEndpointSafety');
const CONFIRMED_HOST = 'aws-1-eu-central-1.pooler.supabase.com';

const DISABLED_FLAGS = Object.freeze([
  'CIVIC_PUSH_ENABLED', 'CIVIC_NEW_INITIATIVE_EVENTS_ENABLED',
  'CIVIC_NEW_INITIATIVE_PUSH_ENABLED', 'ENABLE_MINISTERO_SYNC',
  'ENABLE_CIVIC_PROCESS_SYNC', 'ENABLE_DATA_RETENTION',
  'ENABLE_VIOLATION_MONITORING', 'ENABLE_AUTOMATIC_BACKUP',
  'ENABLE_POLITICAL_TERRITORY_RESOLVER',
  'ENABLE_ITALIAN_ELECTION_UNIT_SYNC', 'ENABLE_VOTI_PARLAMENTO_SYNC',
  'ENABLE_OPENPOLIS_COSA_SUCCEDE_SYNC', 'AXIOM_ARCHIVE_ENABLED',
  'SECURITY_CENTER_RUNTIME_ENABLED', 'GDPR_ERASURE_OUTBOX_WORKER_ENABLED',
  'PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED', 'PARLIAMENT_FINAL_PUSH_ENABLED',
  'CIVIC_STAGING_SESSION_CHECK_APPLY', 'DEMOS_STAGING_ANDROID_PUSH_E2E',
  'ALLOW_DEMOS_STAGING_MIGRATIONS',
]);

const FORBIDDEN_CREDENTIALS = Object.freeze([
  'DIRECT_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PGHOST', 'PGUSER', 'PGPASSWORD',
  'REDIS_URL', 'FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS', 'CIVIC_PUSH_DISPATCH_KEY',
  'AXIOM_API_TOKEN', 'B2_APPLICATION_KEY', 'B2_S3_SECRET_ACCESS_KEY',
]);

const enabled = v => ['true','1','yes','on'].includes(String(v ?? '').trim().toLowerCase());

function isStaging(env) {
  return Boolean(env && !Array.isArray(env) &&
    typeof env === 'object' && env.NODE_ENV === 'staging');
}

// Existing production override remains unchanged. Staging NEVER exposes
// migration/test/cleanup/debug routes even if ALLOW_DEV_API_SURFACE is set.
function shouldMountDevApiSurface(env = {}) {
  if (env.NODE_ENV === 'staging') return false;
  if (env.NODE_ENV === 'production') return env.ALLOW_DEV_API_SURFACE === 'true';
  return true;
}

// Read-only ingress for the first smoke phase: no auth, uploads, admin,
// migrations, cleanup, writes, dispatch, or unreviewed routes can be reached.
const READ_ONLY_CANARY_PATHS = Object.freeze(new Set([
  '/', '/health', '/health/live', '/health/ready',
  '/api/health', '/api/health/live', '/api/health/ready',
  '/api/eci', '/api/iniziative-popolari', '/api/referendum-abrogativi',
]));
function isReadOnlyCanaryRequest(method, path) {
  return (method === 'GET' || method === 'HEAD') &&
    typeof path === 'string' && READ_ONLY_CANARY_PATHS.has(path);
}

function assertStagingAppCanary(env = process.env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    throw new Error('STAGING_APP_CANARY_ENV_INVALID');
  }
  if (!isStaging(env)) return { active: false };
  if (env.DEMOS_UNIFIED_STAGING_MODE !== 'app_canary' ||
      env.DEMOS_STAGING_APP_CANARY_GO !== 'I_APPROVE_STAGING_APP_CANARY' ||
      env.CIVIC_UNIFIED_STAGING_READY !== 'true' ||
      env.CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED !== 'true') {
    throw new Error('STAGING_APP_CANARY_GO_REQUIRED');
  }
  if (env.CIVIC_STAGING_RUNTIME_AUDIT_GO ||
      enabled(env.ALLOW_DEV_API_SURFACE) ||
      env.PERFORMANCE_MONITOR_ENABLED !== 'false' ||
      DISABLED_FLAGS.some(flag => enabled(env[flag]))) {
    throw new Error('STAGING_APP_CANARY_SIDE_EFFECTS_FORBIDDEN');
  }
  if (FORBIDDEN_CREDENTIALS.some(key => env[key] != null &&
      String(env[key]).trim() !== '')) {
    throw new Error('STAGING_APP_CANARY_PROVIDER_CREDENTIALS_FORBIDDEN');
  }
  if (env.CIVIC_STAGING_PROJECT_REF !== DEMOS_STAGING_PROJECT_REF ||
      env.CIVIC_STAGING_EXPECTED_POOLER_HOST !== CONFIRMED_HOST) {
    throw new Error('STAGING_APP_CANARY_WRONG_TARGET');
  }
  let connectionString;
  try {
    connectionString = resolveCivicStagingSessionConnectionString(
      env.CIVIC_STAGING_SESSION_DATABASE_URL);
    if (env.DATABASE_URL && env.DATABASE_URL !== connectionString) {
      throw new Error('STAGING_APP_CANARY_WRONG_TARGET');
    }
    const candidateEnv = {...env};
    delete candidateEnv.DATABASE_URL;
    assertCivicStagingSessionEndpoint({
      connectionString,
      projectRef: DEMOS_STAGING_PROJECT_REF,
      expectedPoolerHost: CONFIRMED_HOST,
      env: candidateEnv,
    });
  } catch {
    throw new Error('STAGING_APP_CANARY_WRONG_TARGET');
  }
  // Never log, serialize to HTTP or persist this return value; the boot
  // entrypoint uses it only to initialize the same validated DB connection.
  return { active: true, connectionString };
}

module.exports = { assertStagingAppCanary, shouldMountDevApiSurface, isReadOnlyCanaryRequest,
  DISABLED_FLAGS, FORBIDDEN_CREDENTIALS };
