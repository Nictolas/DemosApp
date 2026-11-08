'use strict';

// Fail-closed bootstrap: does not import DEMOS app, database, Redis or Firebase.
const http = require('node:http');

function validateBootstrapEnvironment(env) {
  if (env.NODE_ENV !== 'staging' || env.DEMOS_UNIFIED_STAGING_MODE !== 'bootstrap') {
    throw new Error('Unified staging bootstrap requires explicit non-production mode');
  }
  // A bootstrap-only HTTP canary must not carry credentials that could
  // accidentally connect it to the expiring legacy PostgreSQL, Supabase,
  // Redis, Firebase or cloud archives. Runtime application staging uses a
  // separately reviewed mode and must never inherit a bootstrap exception.
  const forbiddenCredentials = [
    'DATABASE_URL', 'DIRECT_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD',
    'SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'REDIS_URL', 'AXIOM_API_TOKEN', 'B2_S3_ACCESS_KEY_ID',
    'B2_S3_SECRET_ACCESS_KEY', 'B2_APPLICATION_KEY',
    'GDPR_LEDGER_B2_ACCESS_KEY_ID', 'GDPR_LEDGER_B2_SECRET_ACCESS_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
  ];
  if (forbiddenCredentials.some(key => env[key] != null &&
      String(env[key]).trim() !== '')) {
    throw new Error('STAGING_BOOTSTRAP_CREDENTIALS_FORBIDDEN');
  }
  // The shared Render service is a liveness-only canary until OPS-STG-001
  // receives a documented GO. No feature may silently opt into real app
  // delivery, jobs, or a PostgreSQL session check while bootstrap is active.
  const forbiddenActiveFlags = [
    'CIVIC_PUSH_ENABLED', 'AXIOM_ARCHIVE_ENABLED',
    'GDPR_LEDGER_B2_ENABLED', 'GDPR_ERASURE_OUTBOX_WORKER_ENABLED',
    'PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED', 'PARLIAMENT_FINAL_PUSH_ENABLED',
    'CIVIC_STAGING_SESSION_CHECK_APPLY',
    'CIVIC_UNIFIED_STAGING_READY', 'CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED',
  ];
  if (forbiddenActiveFlags.some(key =>
    ['true', '1', 'yes', 'on'].includes(String(env[key] ?? '').trim().toLowerCase()))) {
    throw new Error('STAGING_BOOTSTRAP_ACTIVE_FLAGS_FORBIDDEN');
  }
  // Reject port 0 (an ephemeral listener) and non-decimal values in a
  // deployed bootstrap. Local tests can still call server.listen(0) directly.
  const rawPort = env.PORT === undefined || env.PORT === '' ? '10000' : String(env.PORT);
  if (!/^\d{1,5}$/.test(rawPort)) throw new Error('Invalid bootstrap port');
  const port = Number(rawPort);
  if (port < 1 || port > 65535) throw new Error('Invalid bootstrap port');
  return { port };
}
function writeJson(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  res.end(JSON.stringify(body));
}
function createBootstrapServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET') return writeJson(res, 405, { error: 'method_not_allowed' });
    // Node permits absolute-form request targets. Do not allow an arbitrary
    // host or malformed target to be interpreted as a health endpoint, and
    // never let URL parsing errors terminate the bootstrap process.
    if (typeof req.url !== 'string' || !req.url.startsWith('/') || req.url.startsWith('//')) {
      return writeJson(res, 400, { error: 'invalid_request_target' });
    }
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return writeJson(res, 400, { error: 'invalid_request_target' });
    }
    if (pathname === '/health' || pathname === '/health/live') {
      return writeJson(res, 200, {
        status: 'bootstrap_only', environment: 'staging',
        ready_for_app_tests: false, database_connected: false,
        production_access: false, notifications_enabled: false,
      });
    }
    if (pathname === '/health/ready') return writeJson(res, 503, {
      status: 'not_ready', reason: 'schema_credentials_and_e2e_gates_pending',
    });
    return writeJson(res, 404, { error: 'not_found' });
  });
}
function startBootstrap(env = process.env) {
  const { port } = validateBootstrapEnvironment(env);
  const server = createBootstrapServer();
  server.listen(port, '0.0.0.0', () => console.info('[unified-staging] bootstrap-only; app tests disabled'));
  return server;
}
// The existing Render start command is kept unchanged. Only the exact
// preflight mode, with its independent staging-only authorization and ACL
// guards, can dispatch to the separate read-only probe. In bootstrap mode,
// the database and application modules are never even imported.
async function startConfiguredStaging(env=process.env, {
  bootstrap=startBootstrap,
  preflight,
}={}) {
  if (env && env.DEMOS_UNIFIED_STAGING_MODE==='preflight') {
    const start = preflight ||
      require('./unified_staging_preflight_server').startPreflightServer;
    return start(env);
  }
  return bootstrap(env);
}
// Diagnostic output is deliberately limited to a small fixed vocabulary.
// Never log provider exception messages, environment values or raw SQL.
function classifySafeStagingStartupFailure(error) {
  const allowed = new Set([
    'STAGING_PREFLIGHT_MODE_NOT_AUTHORIZED',
    'STAGING_PREFLIGHT_FLAGS_MUST_BE_OFF',
    'STAGING_PREFLIGHT_PROVIDER_CREDENTIALS_FORBIDDEN',
    'STAGING_PREFLIGHT_CREDENTIAL_REQUIRED',
    'STAGING_PREFLIGHT_CREDENTIAL_AMBIGUOUS',
    'STAGING_PREFLIGHT_PASSWORD_INVALID',
    'STAGING_PREFLIGHT_EXACT_POOLER_HOST_REQUIRED',
    'STAGING_PREFLIGHT_SESSION_POOLER_REQUIRED',
    'STAGING_PREFLIGHT_AUDIT_NOT_READY',
    'STAGING_PREFLIGHT_INVALID_PORT',
  ]);
  if (error && allowed.has(error.message)) return error.message;
  const safePgCodes = new Set(['28P01','28000','42501','3D000',
    '08001','08006','57P03','53300','53400']);
  if (error && safePgCodes.has(error.code)) return 'STAGING_PREFLIGHT_SQLSTATE_' + error.code;
  const safeNetworkCodes = new Set(['ENOTFOUND','ECONNREFUSED','ETIMEDOUT',
    'EAI_AGAIN','ECONNRESET','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
  if (error && safeNetworkCodes.has(error.code)) return 'STAGING_PREFLIGHT_NETWORK_' + error.code;
  if (error && error.message==='Staging preflight role is privileged or unauthorized') {
    return 'STAGING_PREFLIGHT_ROLE_REJECTED';
  }
  if (error && error.message==='Staging preflight has unexpected table write grants') {
    return 'STAGING_PREFLIGHT_WRITE_GRANTS_REJECTED';
  }
  if (error && error.message==='Staging preflight has unexpected SELECT grants') {
    return 'STAGING_PREFLIGHT_READ_GRANTS_REJECTED';
  }
  if (error && error.message==='Staging preflight RLS policies are broader than authorized') {
    return 'STAGING_PREFLIGHT_RLS_REJECTED';
  }
  if (error && error.message==='Connected to unauthorized database identity') {
    return 'STAGING_PREFLIGHT_IDENTITY_REJECTED';
  }
  return 'STAGING_STARTUP_UNAVAILABLE';
}
if (require.main===module) {
  startConfiguredStaging().catch(error=>{
    console.error(classifySafeStagingStartupFailure(error));
    process.exitCode=1;
  });
}
module.exports = {validateBootstrapEnvironment,createBootstrapServer,
  startBootstrap,startConfiguredStaging,classifySafeStagingStartupFailure};

