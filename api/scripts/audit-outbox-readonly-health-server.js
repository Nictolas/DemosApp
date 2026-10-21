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

async function startReadonlyHealthServer({
  env = process.env,
  verify = runRenderStagingReadiness,
  serve = (handler, port) => http.createServer(handler).listen(port, '0.0.0.0')
} = {}) {
  assertSafeRenderStagingEnvironment(env);
  const port = Number(env.PORT || '10000');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
  }
  const result = await verify({ env });
  if (result?.result !== 'AUDIT_RENDER_STAGING_PREFLIGHT_OK' ||
      result?.outboxEnabled !== false || result?.archiveEnabled !== false) {
    throw new Error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
  }
  return serve(healthHandler, port);
}

if (require.main === module) {
  startReadonlyHealthServer().then(() => {
    console.log('AUDIT_RENDER_STAGING_PREFLIGHT_OK');
  }).catch(() => {
    // No exception details or secrets may reach Render logs.
    console.error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
    process.exitCode = 1;
  });
}

module.exports = { healthHandler, startReadonlyHealthServer };
