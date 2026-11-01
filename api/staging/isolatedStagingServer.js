'use strict';

const http = require('node:http');
const { assertIsolatedStagingEnvironment } = require('./isolatedStagingGuard');

// CI-only/free staging must not accept connections on public interfaces.
// Future Render ingress requires an EXPLICIT code review and authorization.
const STAGING_LISTEN_ADDRESS = '127.0.0.1';

// Readiness-only: no app, database pool, Firebase, route or worker import.
// Until provider quarantine is independently attested, NEVER import ../server.
function createReadinessHandler() {
  return (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET' && request.url === '/__staging/health') {
      response.statusCode = 200;
      response.end(JSON.stringify({
        status: 'preflight-only',
        gdprReady: false,
        databaseConnected: false,
        externalProvidersConnected: false
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not_found' }));
  };
}

function startIsolatedStaging({
  env = process.env,
  launch = (runtimeEnv) => http.createServer(createReadinessHandler())
    .on('error', () => {
      console.error('DEMOS_STAGING_HTTP_START_FAILED');
      process.exitCode = 1;
    })
    .listen(Number(runtimeEnv.PORT), STAGING_LISTEN_ADDRESS)
} = {}) {
  // Complete this offline check BEFORE opening even a local HTTP socket.
  const attestation = assertIsolatedStagingEnvironment(env);
  launch(env);
  return attestation;
}

if (require.main === module) {
  try {
    startIsolatedStaging();
  } catch (_) {
    // Fixed message: never print a rejected connection string or env value.
    console.error('DEMOS_STAGING_BOOT_REJECTED');
    process.exitCode = 1;
  }
}

module.exports = { startIsolatedStaging, createReadinessHandler, STAGING_LISTEN_ADDRESS };
