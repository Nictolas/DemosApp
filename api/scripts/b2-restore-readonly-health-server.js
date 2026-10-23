'use strict';

// Isolated, dormant-until-authorized Render Free probe for a real Backblaze B2
// READ-ONLY recovery drill. No application DB, Axiom or Firebase access.
const http = require('node:http');
const { assertReadOnlyB2RestoreEnvironment, verifyB2RestoreReadOnly } =
  require('./verify-b2-restore-readonly');

function healthHandler(ready) {
  return (req, res) => {
    const health = req.method === 'GET' && req.url === '/healthz';
    const headers = { 'content-type': 'text/plain', 'cache-control': 'no-store' };
    res.writeHead(health ? (ready ? 200 : 503) : 404, headers);
    res.end(health ? (ready ? 'ok\n' : 'not ready\n') : 'not found\n');
  };
}

function assertB2StandbyEnvironment(env) {
  const keys = ['B2_S3_ACCESS_KEY_ID', 'B2_S3_SECRET_ACCESS_KEY'];
  if (env.B2_RESTORE_READONLY_MODE !== 'true' ||
      env.AXIOM_ARCHIVE_ENABLED === 'true' ||
      env.B2_S3_ENDPOINT !== 'https://s3.eu-central-003.backblazeb2.com' ||
      env.B2_S3_REGION !== 'eu-central-003' ||
      env.B2_BUCKET_NAME !== 'demos-log-archive-eu' ||
      (env.AXIOM_ARCHIVE_PREFIX &&
       env.AXIOM_ARCHIVE_PREFIX !== 'demos/axiom-archive/v1') ||
      ['DATABASE_URL','AUDIT_OUTBOX_DATABASE_URL','AXIOM_API_TOKEN',
       'AXIOM_ORG_ID','B2_APPLICATION_KEY_ID','B2_APPLICATION_KEY']
        .some(key => Boolean(env[key])) ||
      keys.some(key => Boolean(env[key]))) {
    throw new Error('B2_READONLY_STANDBY_CONFIGURATION_REJECTED');
  }
}

async function startB2ReadonlyHealth({
  env = process.env,
  verify = verifyB2RestoreReadOnly,
  listen = (handler, port) =>
    http.createServer(handler).listen(port, '0.0.0.0')
} = {}) {
  const port = Number(env.PORT || '10000');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('B2_READONLY_HEALTH_CONFIGURATION_REJECTED');
  }
  const accessKey = Boolean(env.B2_S3_ACCESS_KEY_ID);
  const secretKey = Boolean(env.B2_S3_SECRET_ACCESS_KEY);
  if (!accessKey && !secretKey) {
    assertB2StandbyEnvironment(env);
    return { ready: false, listener: listen(healthHandler(false), port) };
  }
  if (!accessKey || !secretKey) {
    throw new Error('B2_READONLY_HEALTH_CONFIGURATION_REJECTED');
  }
  assertReadOnlyB2RestoreEnvironment(env);
  const result = await verify({ env });
  if (result?.status !== 'B2_READONLY_RESTORE_VERIFIED' ||
      !Array.isArray(result?.summaries) ||
      result.summaries.length !== 2 ||
      result.summaries[0]?.dataset !== 'centralized_logs' ||
      result.summaries[1]?.dataset !== 'real-time') {
    throw new Error('B2_READONLY_HEALTH_VERIFICATION_REJECTED');
  }
  return { ready: true, listener: listen(healthHandler(true), port) };
}

if (require.main === module) {
  startB2ReadonlyHealth().then(({ ready }) => {
    console.log(ready
      ? 'B2_READONLY_RESTORE_VERIFIED'
      : 'B2_READONLY_RESTORE_STANDBY_NO_SECRET');
  }).catch(() => {
    // No provider exception text, credentials, object keys or archived events.
    console.error('B2_READONLY_RESTORE_REJECTED');
    process.exitCode = 1;
  });
}

module.exports = {
  healthHandler, assertB2StandbyEnvironment, startB2ReadonlyHealth
};
