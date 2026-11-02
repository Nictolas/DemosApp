'use strict';

// Fail-closed bootstrap: does not import DEMOS app, database, Redis or Firebase.
const http = require('node:http');

function validateBootstrapEnvironment(env) {
  if (env.NODE_ENV !== 'staging' || env.DEMOS_UNIFIED_STAGING_MODE !== 'bootstrap') {
    throw new Error('Unified staging bootstrap requires explicit non-production mode');
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
if (require.main === module) startBootstrap();
module.exports = { validateBootstrapEnvironment, createBootstrapServer, startBootstrap };
