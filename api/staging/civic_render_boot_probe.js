'use strict';

// Deployment-only canary for DEMOS civic notifications.
// NEVER import the production API, DB pool or Firebase, send a message,
// load user data, or report GO. A later *separately authorized* read-only
// database probe must use an explicit staging-only connection.
const http = require('node:http');

function assertDeploymentOnlyEnvironment(env = process.env) {
  if (env.CIVIC_STAGING_PROBE_ONLY !== 'true') {
    throw new Error('CIVIC_STAGING_PROBE_NOT_AUTHORIZED');
  }
  if (env.DATABASE_URL || env.PGHOST || env.PGUSER ||
      env.SUPABASE_SERVICE_ROLE_KEY || env.GOOGLE_APPLICATION_CREDENTIALS ||
      env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('CIVIC_STAGING_PROBE_CREDENTIALS_NOT_PERMITTED');
  }
  const forbiddenFlags = [
    'CIVIC_PUSH_ENABLED',
    'CIVIC_NEW_INITIATIVE_EVENTS_ENABLED',
    'CIVIC_SESSION_LOCK_CONNECTION_VERIFIED',
    'CIVIC_SESSION_AFFINITY_PROBE_APPLY',
    'CIVIC_TOPIC_RECONCILE_APPLY',
    'CIVIC_ROLLBACK_APPLY',
  ];
  if (forbiddenFlags.some((key) => env[key] === 'true')) {
    throw new Error('CIVIC_STAGING_PROBE_ACTIVE_FLAGS_REFUSED');
  }
  return true;
}

function createServer(env = process.env) {
  assertDeploymentOnlyEnvironment(env);
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' || !['/', '/health'].includes(req.url)) {
      res.writeHead(404);
      res.end('{"error":"NOT_FOUND"}');
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      service: 'demos-civic-staging-deploy-probe',
      deployment: 'RUNNING',
      database: 'NOT_TESTED',
      backend: 'NOT_STARTED',
      sessionAffinity: 'NOT_TESTED',
      firebase: 'DISABLED',
      civicPush: 'DISABLED',
      releaseGate: 'NO_GO',
    }));
  });
}

if (require.main === module) {
  try {
    const server = createServer();
    const port = Number(process.env.PORT || 10000);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
      throw new Error('INVALID_PORT');
    }
    server.listen(port, '0.0.0.0', () => {
      console.log('CIVIC_STAGING_DEPLOY_PROBE_RUNNING_NO_DATABASE_NO_FCM');
    });
  } catch {
    // Never log the environment or original provider errors.
    console.error('CIVIC_STAGING_DEPLOY_PROBE_REFUSED');
    process.exitCode = 1;
  }
}

module.exports = { assertDeploymentOnlyEnvironment, createServer };
