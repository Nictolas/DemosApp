process.env.NODE_ENV = 'production';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const {
  SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX,
  buildSecurityPhase2DeployedHarnessConfig,
  mountSecurityPhase2DeployedHarness
} = require('../security-agent/securityPhase2DeployedHarness');

const token = 'v'.repeat(48);
function safeEnv(overrides = {}) {
  return {
    SECURITY_PHASE2_DEPLOYED_VALIDATION_ENABLED: 'true',
    SECURITY_PHASE2_DEPLOYED_VALIDATION_TOKEN: token,
    SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_STAGING_ID: 'demos-security-staging',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_AGENT_STORE_ENABLED: 'false',
    SECURITY_RETENTION_JOB_ENABLED: 'false',
    SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'false',
    SECURITY_ACTION_RUNNER_ENABLED: 'false',
    ACTION_RUNNER_ENABLED: 'false',
    SECURITY_AGENT_SHADOW_ENABLED: 'false',
    SECURITY_AGENT_AXIOM_ENABLED: 'false',
    ...overrides
  };
}

function request(server, path, { method = 'GET', headers = {}, body = null } = {}) {
  const address = server.address();
  const payload = body == null ? null : JSON.stringify(body);
  const requestHeaders = { ...headers };
  if (payload != null) {
    requestHeaders['content-type'] = 'application/json';
    requestHeaders['content-length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method, headers: requestHeaders }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: text ? JSON.parse(text) : null
      }));
    });
    req.on('error', reject);
    if (payload != null) req.write(payload);
    req.end();
  });
}

async function createServer(env = safeEnv()) {
  const app = express();
  app.set('trust proxy', 1);
  mountSecurityPhase2DeployedHarness({ app, env });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return server;
}

const authHeaders = extra => ({ authorization: `Bearer ${token}`, ...(extra || {}) });

test('Phase 2 deployed harness is disabled by default and fail-closed outside isolated staging', () => {
  const disabled = buildSecurityPhase2DeployedHarnessConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.ready, false);
  assert.equal(disabled.executable, false);

  const production = buildSecurityPhase2DeployedHarnessConfig(safeEnv({ SECURITY_AGENT_ENVIRONMENT_CLASS: 'production' }));
  assert.equal(production.ready, false);
  assert.ok(production.blockers.includes('staging_isolation_not_ready'));
  assert.ok(production.blockers.includes('environment_class_not_staging'));

  const actionRunner = buildSecurityPhase2DeployedHarnessConfig(safeEnv({ ACTION_RUNNER_ENABLED: 'true' }));
  assert.equal(actionRunner.ready, false);
  assert.ok(actionRunner.blockers.includes('staging_isolation_not_ready'));

  const missingToken = buildSecurityPhase2DeployedHarnessConfig(safeEnv({ SECURITY_PHASE2_DEPLOYED_VALIDATION_TOKEN: '' }));
  assert.equal(missingToken.ready, false);
  assert.ok(missingToken.blockers.includes('validation_token_invalid'));
});

test('Phase 2 deployed harness status is protected and never exposes secret material', async t => {
  const server = await createServer();
  t.after(() => server.close());

  const unauth = await request(server, `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/status`);
  assert.equal(unauth.status, 401);

  const status = await request(server, `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/status`, { headers: authHeaders() });
  assert.equal(status.status, 200);
  assert.equal(status.body.state, 'ready');
  assert.equal(status.body.productionTouched, false);
  assert.equal(status.body.databaseWriterAllowed, false);
  assert.equal(status.body.actionRunnerAvailable, false);
  assert.equal(status.body.executable, false);
  assert.equal(status.body.renderKv.enabled, false);
  assert.equal(JSON.stringify(status.body).includes(token), false);
  assert.equal(JSON.stringify(status.body).includes('redis://'), false);
});

test('RT01 deployed harness rate-limits one source while a different source remains unaffected and detection fires', async t => {
  const server = await createServer();
  t.after(() => server.close());
  const path = `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/rt01/login`;

  let attacker = null;
  for (let i = 0; i < 101; i += 1) {
    attacker = await request(server, path, {
      method: 'POST',
      headers: authHeaders({ 'x-phase2-source': 'attacker-a' })
    });
  }
  assert.equal(attacker.status, 429);
  assert.equal(attacker.headers['x-phase2-downstream'], undefined);

  const legitimate = await request(server, path, {
    method: 'POST',
    headers: authHeaders({ 'x-phase2-source': 'legitimate-b' })
  });
  assert.equal(legitimate.status, 401);
  assert.equal(legitimate.headers['x-phase2-downstream'], 'reached');

  const evidence = await request(server, `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/evidence`, { headers: authHeaders() });
  assert.ok(evidence.body.RT01.observedAttempts >= 102);
  assert.equal(evidence.body.RT01.finding.ruleId, 'DET-AUTH-FAILED-BURST');
  assert.equal(evidence.body.RT01.finding.severity, 'high');
});

test('RT02 deployed harness blocks SQLi before downstream and correlates a critical finding', async t => {
  const server = await createServer();
  t.after(() => server.close());
  const path = `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/rt02/probe`;

  const malicious = await request(server, path, {
    method: 'POST',
    headers: authHeaders(),
    body: { q: "x' OR 1=1 --" }
  });
  assert.equal(malicious.status, 400);
  assert.equal(malicious.headers['x-phase2-downstream'], undefined);
  assert.match(malicious.body.message, /SQL injection/i);

  const benign = await request(server, path, {
    method: 'POST',
    headers: authHeaders(),
    body: { q: 'normal-value' }
  });
  assert.equal(benign.status, 204);
  assert.equal(benign.headers['x-phase2-downstream'], 'reached');

  const evidence = await request(server, `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/evidence`, { headers: authHeaders() });
  assert.equal(evidence.body.RT02.blockedBeforeDownstream, 1);
  assert.equal(evidence.body.RT02.downstreamReached, 1);
  assert.equal(evidence.body.RT02.finding.ruleId, 'DET-SUSPICIOUS-REQUEST');
  assert.equal(evidence.body.RT02.finding.severity, 'critical');
});

test('RT05 deployed harness validates target-only revocation using the real service contract and isolated memory state', async t => {
  const server = await createServer();
  t.after(() => server.close());
  const result = await request(server, `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/rt05/probe`, {
    method: 'POST', headers: authHeaders()
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'pass');
  assert.equal(result.body.backend, 'ephemeral-memory');
  assert.equal(result.body.targetRevoked, true);
  assert.equal(result.body.otherRevoked, false);
  assert.equal(result.body.cleanupConfirmed, true);
  assert.equal(result.body.storedKeyCount, 0);
  assert.equal(result.body.productionWrite, false);
});

test('RT06 deployed harness proves critical escalation stays non-executable without attempting a freeze', async t => {
  const server = await createServer();
  t.after(() => server.close());
  const result = await request(server, `${SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX}/rt06/guardrail`, {
    method: 'POST', headers: authHeaders()
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'pass');
  assert.equal(result.body.finding.ruleId, 'DET-ADMIN-FAILED-BURST');
  assert.equal(result.body.finding.severity, 'critical');
  assert.equal(result.body.policyDecision, 'escalate');
  assert.equal(result.body.freezeAttempted, false);
  assert.equal(result.body.authorized, false);
  assert.equal(result.body.executable, false);
  assert.equal(result.body.actionRunnerAvailable, false);
});
