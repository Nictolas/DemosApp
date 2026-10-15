const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { buildSecurityCenterStagingServerConfig, buildPublicStagingHealth, createSecurityCenterStagingApp, parsePort } = require('../security-agent/securityCenterStagingServer');

const token = 't'.repeat(48);
const safeEnv = extra => ({
  NODE_ENV: 'production',
  PORT: '3001',
  SECURITY_STAGING_SERVER_ENABLED: 'true',
  SECURITY_CENTER_RUNTIME_ENABLED: 'true',
  SECURITY_CENTER_RUNTIME_PREFIX: '/api/security-center',
  SECURITY_CENTER_STAGING_AUTH_ENABLED: 'true',
  SECURITY_CENTER_STAGING_ADMIN_TOKEN: token,
  SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
  SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
  SECURITY_AGENT_STAGING_ID: 'demos-security-staging',
  SECURITY_AGENT_RUNTIME_MODE: 'memory',
  SECURITY_AGENT_STORE_ENABLED: 'false',
  SECURITY_RETENTION_JOB_ENABLED: 'false',
  SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'false',
  SECURITY_AGENT_SHADOW_ENABLED: 'false',
  SECURITY_AGENT_AXIOM_ENABLED: 'false',
  ...extra
});

function request(server, path, headers = {}) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method: 'GET', headers }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: body ? JSON.parse(body) : null }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('port parsing is bounded', () => {
  assert.equal(parsePort(undefined), 3001);
  assert.equal(parsePort('443'), 443);
  assert.equal(parsePort('0'), null);
  assert.equal(parsePort('70000'), null);
  assert.equal(parsePort('abc'), null);
});

test('server is disabled by default and requires all staging gates', () => {
  const disabled = buildSecurityCenterStagingServerConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.ready, false);
  const blocked = buildSecurityCenterStagingServerConfig(safeEnv({ SECURITY_AGENT_RUNTIME_MODE: 'postgres' }));
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockers.includes('security_center_mount_not_ready'));
  assert.ok(blocked.blockers.includes('staging_auth_not_ready'));
});

test('safe config is memory-only, DB-free and non executable', () => {
  const cfg = buildSecurityCenterStagingServerConfig(safeEnv());
  assert.equal(cfg.ready, true);
  assert.equal(cfg.databaseRequired, false);
  assert.equal(cfg.databaseWriterAllowed, false);
  assert.equal(cfg.authorized, false);
  assert.equal(cfg.executable, false);
  assert.equal(cfg.actionRunnerAvailable, false);
  assert.equal(JSON.stringify(cfg).includes(token), false);
});


test('public staging health exposes sanitized live telemetry state without credentials or event data', async () => {
  const service = {
    async getHealth() {
      return {
        agent: { enabled: true, inFlight: false, lastRunStatus: 'ok', runCount: 1, failureCount: 0 },
        telemetry: { status: 'healthy', lastSuccessAt: '2026-10-06T19:47:27.000Z', consecutiveFailures: 0, totals: { polls: 1, fetched: 0, accepted: 0, duplicates: 0 } }
      };
    }
  };
  const health = await buildPublicStagingHealth({ service, now: () => new Date('2026-10-06T19:48:00.000Z') });
  assert.equal(health.state, 'ready');
  assert.equal(health.agent.lastRunStatus, 'ok');
  assert.equal(health.agent.runCount, 1);
  assert.equal(health.telemetry.status, 'healthy');
  assert.equal(health.telemetry.polls, 1);
  assert.equal(health.executable, false);
  assert.equal(health.actionRunnerAvailable, false);
  assert.equal(JSON.stringify(health).includes(token), false);
  assert.equal(JSON.stringify(health).includes('demos-security-staging'), false);
});

test('minimal staging server exposes only health and protected Security Center reads', async t => {
  const app = createSecurityCenterStagingApp({ env: safeEnv() });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());

  const health = await request(server, '/healthz');
  assert.equal(health.status, 200);
  assert.equal(health.body.databaseRequired, false);
  assert.equal(health.body.executable, false);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-frame-options'], 'DENY');

  const unauth = await request(server, '/api/security-center/ai-policy');
  assert.equal(unauth.status, 401);

  const auth = await request(server, '/api/security-center/ai-policy', { Authorization: 'Bearer ' + token });
  assert.equal(auth.status, 200);
  assert.equal(auth.body.success, true);
  assert.equal(auth.body.data.status.executable, false);

  const unknown = await request(server, '/api/users');
  assert.equal(unknown.status, 404);
});

test('unsafe NODE_ENV or missing auth token blocks app creation before listen', () => {
  assert.throws(() => createSecurityCenterStagingApp({ env: safeEnv({ NODE_ENV: 'development' }) }), /SECURITY_CENTER_STAGING_SERVER_BLOCKED/);
  assert.throws(() => createSecurityCenterStagingApp({ env: safeEnv({ SECURITY_CENTER_STAGING_ADMIN_TOKEN: '' }) }), /SECURITY_CENTER_STAGING_SERVER_BLOCKED/);
});
