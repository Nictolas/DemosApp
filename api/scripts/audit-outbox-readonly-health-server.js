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
  assertSafeRenderStagingEnvironment(env);
  const result = await verify({ env });
  if (result?.result !== 'AUDIT_RENDER_STAGING_PREFLIGHT_OK' ||
      result?.outboxEnabled !== false || result?.archiveEnabled !== false) {
    throw new Error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
  }
  return serve(healthHandler, port);
}

function safeStartupFailureCode(error) {
  // Never print arbitrary driver/URL exception text to Render logs.
  switch (error?.message) {
    case 'AUDIT_RENDER_STAGING_ENV_REJECTED':
    case 'AUDIT_OUTBOX_STANDALONE_PREFLIGHT_REJECTED':
    case 'AUDIT_STAGING_TARGET_REJECTED':
      return 'AUDIT_RENDER_STAGING_CONFIGURATION_REJECTED';
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

module.exports = { healthHandler, waitingHandler, safeStartupFailureCode, startupStatus, startReadonlyHealthServer };
