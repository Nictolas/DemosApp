process.env.NODE_ENV = 'production';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { authLimiter } = require('../middleware/rateLimiting');
const { securityMiddleware } = require('../middleware/security');
const { DetectionEngine } = require('../security-agent/detectionEngine');
const redisCache = require('../services/redisCache');
const revocation = require('../services/accessRevocationService');
const { evaluateAiPolicy } = require('../security-agent/securityPolicyEngine');
const { buildExecutionBoundary } = require('../security-agent/securityExecutionBoundary');

const NOW = new Date('2026-10-06T09:00:00.000Z');
function event(category, type, index = 0) {
  return { eventId: `rt-${category}-${type}-${index}`, timestamp: new Date(NOW.getTime() - index).toISOString(), category, type, severity: 'info' };
}

async function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

async function close(server) {
  await new Promise(resolve => server.close(resolve));
}

test('RT01 ephemeral staging: brute-force source is rate-limited while a different source remains unaffected and detection alerts', async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/login', authLimiter, (_req, res) => res.status(401).json({ success: false }));
  const server = await listen(app);
  try {
    const port = server.address().port;
    const hit = ip => fetch(`http://127.0.0.1:${port}/login`, { headers: { 'x-forwarded-for': ip } }).then(r => r.status);
    let attackerStatus = 0;
    for (let i = 0; i < 101; i += 1) attackerStatus = await hit('198.51.100.10');
    const legitimateStatus = await hit('198.51.100.20');
    assert.equal(attackerStatus, 429);
    assert.equal(legitimateStatus, 401);

    const events = Array.from({ length: 10 }, (_, i) => event('auth', 'login.failed', i));
    const finding = new DetectionEngine().evaluate(events, NOW).find(item => item.ruleId === 'DET-AUTH-FAILED-BURST');
    assert.ok(finding);
    assert.equal(finding.severity, 'high');
  } finally {
    await close(server);
  }
});

test('RT02 ephemeral staging: SQLi is blocked before downstream/DB work and correlated as critical detection', () => {
  let downstreamCalled = false;
  const req = {
    body: { q: "x' OR 1=1 --" }, query: {}, params: {}, ip: '203.0.113.10',
    get: () => ''
  };
  const res = {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  securityMiddleware(req, res, () => { downstreamCalled = true; });
  assert.equal(res.statusCode, 400);
  assert.equal(downstreamCalled, false);
  assert.match(res.payload?.message || '', /SQL injection/i);

  const finding = new DetectionEngine().evaluate([event('application', 'request.suspicious')], NOW)
    .find(item => item.ruleId === 'DET-SUSPICIOUS-REQUEST');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
});

test('RT05 ephemeral staging: revocation is target-session only', async (t) => {
  const originalGetClient = redisCache.getClient;
  const data = new Map();
  redisCache.getClient = () => ({
    get: async key => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value); return 'OK'; }
  });
  t.after(() => { redisCache.getClient = originalGetClient; });

  await revocation.revokeAccessSession('session-target', 300);
  assert.equal(await revocation.isAccessSessionRevoked({ sid: 'session-target' }), true);
  assert.equal(await revocation.isAccessSessionRevoked({ sid: 'session-other' }), false);
  assert.equal(data.size, 1);
});

test('RT06 guardrail staging: simulated admin compromise escalates but freeze/session actions stay non-executable', () => {
  const events = Array.from({ length: 5 }, (_, i) => event('auth', 'admin.login.failed', i));
  const finding = new DetectionEngine().evaluate(events, NOW).find(item => item.ruleId === 'DET-ADMIN-FAILED-BURST');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');

  const policy = evaluateAiPolicy({
    prioritySuggestion: 'P0',
    recommendedActions: ['propose_session_revocation', 'propose_endpoint_isolation'],
    requiresHumanReview: true
  });
  assert.equal(policy.decision, 'escalate');
  assert.equal(policy.executable, false);
  assert.ok(policy.actions.every(action => action.decision === 'escalate' && action.executable === false));

  const boundary = buildExecutionBoundary({
    state: 'approved', approvalId: 'rt06-synthetic-approval', action: 'propose_endpoint_isolation', priority: 'P0'
  }, { now: () => NOW });
  assert.equal(boundary.authorized, false);
  assert.equal(boundary.executable, false);
  assert.equal(boundary.actionRunnerAvailable, false);
});
