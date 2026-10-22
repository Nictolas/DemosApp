'use strict';

// Isolated Render Free web service for a single database-login readiness check.
// On success, exposes only a public "ok" health response. Never serves events,
// logs, database credentials, API routes, workers, Axiom, B2 or FCM.
const http = require('node:http');
const { assertSafeRenderStagingEnvironment, runRenderStagingReadiness } =
  require('../services/auditOutboxRenderStagingReadiness');

function healthHandler(req, res) {
  if (req.method !== 'GET' || req.url !== '/healthz') {
    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
  res.end('ok\n');
}

// The service can be provisioned without secrets. It performs no database
// connection until a human securely configures the dedicated staging URL.
function waitingHandler(req, res) {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end('staging probe pending configuration\n');
    return;
  }
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(503, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end('not ready\n');
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
  res.end('not found\n');
}

// Supabase's URI is fixed except for the password. If a password includes
// literal URL-reserved characters (for example '#', '?' or '/'), WHATWG URL
// may reject the whole URI even though the host/role are correct. In this
// isolated staging-only diagnostic we can percent-encode ONLY the password,
// and only when both the prefix and suffix exactly match the verified target.
// We never print, return or persist either form of the secret.
function normalizeReadonlyStagingUri(connectionString) {
  if (typeof connectionString !== 'string') return connectionString;
  const prefix = 'postgresql://demos_outbox_runtime.fkeayjzvtuvzesljhjbc:';
  const suffix = '@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
  if (!connectionString.startsWith(prefix) ||
      !connectionString.endsWith(suffix)) return connectionString;
  const password = connectionString.slice(prefix.length, -suffix.length);
  if (!password || password.length > 1024 ||
      /[\r\n\t]/.test(password)) return connectionString;
  try {
    const url = new URL(connectionString);
    if (url.hostname === 'aws-1-eu-central-1.pooler.supabase.com' &&
        url.port === '5432' && url.pathname === '/postgres' &&
        url.username === 'demos_outbox_runtime.fkeayjzvtuvzesljhjbc' &&
        url.password && !url.hash && !url.search) {
      return connectionString;
    }
  } catch (_) {
    // The exact role/host/port suffix is required before any normalization.
  }
  return prefix + encodeURIComponent(password) + suffix;
}

async function startReadonlyHealthServer({
  env = process.env,
  verify = runRenderStagingReadiness,
  serve = (handler, port) => http.createServer(handler).listen(port, '0.0.0.0')
} = {}) {
  const port = Number(env.PORT || '10000');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
  }
  if (!env.AUDIT_OUTBOX_DATABASE_URL) {
    const forbidden = [
      'AUDIT_OUTBOX_ENABLED', 'AUDIT_OUTBOX_WORKER_ENABLED',
      'AUDIT_OUTBOX_SECURITY_ENABLED', 'AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED',
      'AXIOM_ARCHIVE_ENABLED'
    ];
    if (env.AUDIT_OUTBOX_PREFLIGHT_ONLY !== 'true' ||
        env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE !== 'staging' ||
        env.DATABASE_URL ||
        env.AXIOM_REALTIME_DATASET !== 'demos-security-staging' ||
        env.AXIOM_DATASET !== 'demos-security-staging' ||
        forbidden.some(key => env[key] === 'true')) {
      throw new Error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
    }
    // Standby mode explicitly cannot report a successful /healthz.
    return serve(waitingHandler, port);
  }
  // Decode neither the password nor endpoint metadata. Normalize only
  // syntactically reserved characters in the password of the pinned staging
  // URL; all normal worker code keeps its existing strict URL rules.
  const readinessEnv = {
    ...env,
    AUDIT_OUTBOX_DATABASE_URL: normalizeReadonlyStagingUri(env.AUDIT_OUTBOX_DATABASE_URL)
  };
  assertSafeRenderStagingEnvironment(readinessEnv);
  const result = await verify({ env: readinessEnv });
  if (result?.result !== 'AUDIT_RENDER_STAGING_PREFLIGHT_OK' ||
      result?.outboxEnabled !== false || result?.archiveEnabled !== false) {
    throw new Error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
  }
  return serve(healthHandler, port);
}

function safeStagingConfigurationCode(env = process.env) {
  // Never echo values. This is a closed list of fixed diagnostic labels.
  if (env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE !== 'staging' ||
      env.AUDIT_OUTBOX_PREFLIGHT_ONLY !== 'true' ||
      env.AXIOM_REALTIME_DATASET !== 'demos-security-staging' ||
      env.AXIOM_DATASET !== 'demos-security-staging' ||
      ['AUDIT_OUTBOX_ENABLED', 'AUDIT_OUTBOX_WORKER_ENABLED',
       'AUDIT_OUTBOX_SECURITY_ENABLED', 'AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED',
       'AXIOM_ARCHIVE_ENABLED'].some(key => env[key] === 'true')) {
    return 'AUDIT_RENDER_CONFIG_FLAGS_REJECTED';
  }
  if (env.DATABASE_URL) return 'AUDIT_RENDER_CONFIG_PRIMARY_DB_FORBIDDEN';
  if (!env.AUDIT_OUTBOX_DATABASE_URL) return 'AUDIT_RENDER_CONFIG_OUTBOX_URL_MISSING';
  let target;
  try {
    target = new URL(env.AUDIT_OUTBOX_DATABASE_URL);
  } catch (_) {
    return 'AUDIT_RENDER_CONFIG_URL_INVALID';
  }
  if (!target.password) return 'AUDIT_RENDER_CONFIG_PASSWORD_MISSING';
  if (target.username !== 'demos_outbox_runtime.fkeayjzvtuvzesljhjbc') {
    return 'AUDIT_RENDER_CONFIG_ROLE_REJECTED';
  }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
      target.hostname !== 'aws-1-eu-central-1.pooler.supabase.com' ||
      target.port !== '5432' || target.pathname !== '/postgres' ||
      target.hash !== '') {
    return 'AUDIT_RENDER_CONFIG_ENDPOINT_REJECTED';
  }
  return 'AUDIT_RENDER_STAGING_CONFIGURATION_REJECTED';
}

function safeStartupFailureCode(error, env = process.env) {
  // Never print arbitrary driver/URL exception text to Render logs.
  switch (error?.message) {
    case 'AUDIT_RENDER_STAGING_ENV_REJECTED':
    case 'AUDIT_OUTBOX_STANDALONE_PREFLIGHT_REJECTED':
    case 'AUDIT_STAGING_TARGET_REJECTED':
      return safeStagingConfigurationCode(env);
    case 'AUDIT_OUTBOX_DATABASE_PREFLIGHT_FAILED':
      return 'AUDIT_RENDER_STAGING_DATABASE_CONNECTION_REJECTED';
    default:
      return 'AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED';
  }
}

function startupStatus(env = process.env) {
  return env.AUDIT_OUTBOX_DATABASE_URL
    ? 'AUDIT_RENDER_STAGING_PREFLIGHT_OK'
    : 'AUDIT_RENDER_STAGING_STANDBY_NO_DB_SECRET';
}

if (require.main === module) {
  startReadonlyHealthServer().then(() => {
    // Without a secret this is a standby listener, NOT a verified DB login.
    console.log(startupStatus());
  }).catch(error => {
    // Only fixed error categories: never log driver errors or connection URL.
    console.error(safeStartupFailureCode(error));
    process.exitCode = 1;
  });
}

module.exports = { healthHandler, waitingHandler, normalizeReadonlyStagingUri, safeStagingConfigurationCode, safeStartupFailureCode, startupStatus, startReadonlyHealthServer };
