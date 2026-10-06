const crypto = require('node:crypto');
const express = require('express');
const { authLimiter } = require('../middleware/rateLimiting');
const { securityMiddleware } = require('../middleware/security');
const { createAccessRevocationService } = require('../services/accessRevocationService');
const { DetectionEngine } = require('./detectionEngine');
const { evaluateAiPolicy } = require('./securityPolicyEngine');
const { buildExecutionBoundary } = require('./securityExecutionBoundary');
const { buildSecurityStagingIsolationConfig } = require('./securityStagingIsolation');

const SECURITY_PHASE2_DEPLOYED_HARNESS_VERSION = 'v0.99';
const SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX = '/__security-phase2-validation';
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 128;

function constantTimeMatch(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function buildSecurityPhase2DeployedHarnessConfig(env = {}) {
  const enabled = env.SECURITY_PHASE2_DEPLOYED_VALIDATION_ENABLED === 'true';
  const token = String(env.SECURITY_PHASE2_DEPLOYED_VALIDATION_TOKEN || '');
  const isolation = buildSecurityStagingIsolationConfig(env);
  const blockers = [];

  if (enabled) {
    if (isolation.required !== true) blockers.push('staging_isolation_not_required');
    if (isolation.ready !== true) blockers.push('staging_isolation_not_ready');
    if (isolation.environmentClass !== 'staging') blockers.push('environment_class_not_staging');
    if (isolation.runtimeMode !== 'memory') blockers.push('runtime_not_memory');
    if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) blockers.push('validation_token_invalid');
  }

  return Object.freeze({
    version: SECURITY_PHASE2_DEPLOYED_HARNESS_VERSION,
    enabled,
    ready: enabled && blockers.length === 0,
    prefix: SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX,
    readOnlyProduction: true,
    syntheticStateOnly: true,
    databaseWriterAllowed: false,
    actionRunnerAvailable: false,
    executable: false,
    blockers: Object.freeze([...new Set(blockers)])
  });
}

function phase2Auth(env) {
  const expected = String(env.SECURITY_PHASE2_DEPLOYED_VALIDATION_TOKEN || '');
  return (req, res, next) => {
    const header = String(req.get('authorization') || '');
    const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!constantTimeMatch(provided, expected)) {
      return res.status(401).json({ success: false, error: 'Validation token required' });
    }
    return next();
  };
}

function syntheticEvent(category, type, index, now = new Date()) {
  return {
    eventId: `phase2-${category}-${type}-${index}`,
    timestamp: new Date(now).toISOString(),
    category,
    type,
    severity: 'info'
  };
}

function createMemoryRevocationClient() {
  const data = new Map();
  return {
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { data.set(key, value); return 'OK'; },
    size() { return data.size; }
  };
}

function publicHarnessStatus(config, state) {
  return Object.freeze({
    version: SECURITY_PHASE2_DEPLOYED_HARNESS_VERSION,
    state,
    enabled: config.enabled,
    ready: config.ready,
    prefix: config.prefix,
    readOnlyProduction: true,
    syntheticStateOnly: true,
    productionTouched: false,
    databaseWriterAllowed: false,
    actionRunnerAvailable: false,
    executable: false,
    blockers: config.blockers
  });
}

function createSecurityPhase2DeployedHarnessRouter({ env = process.env, now = () => new Date() } = {}) {
  const config = buildSecurityPhase2DeployedHarnessConfig(env);
  if (!config.enabled || !config.ready) {
    const error = new Error('SECURITY_PHASE2_DEPLOYED_HARNESS_BLOCKED');
    error.code = 'SECURITY_PHASE2_DEPLOYED_HARNESS_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }

  const router = express.Router();
  const auth = phase2Auth(env);
  const detection = new DetectionEngine();
  const rt01Events = [];
  const rt02Events = [];
  let rt02BlockedCount = 0;
  let rt02DownstreamCount = 0;
  let rt05PassCount = 0;
  let rt06PassCount = 0;
  let sequence = 0;

  router.use(express.json({ limit: '16kb' }));
  router.use(auth);

  router.get('/status', (_req, res) => res.json(publicHarnessStatus(config, 'ready')));

  router.post('/rt01/login', (req, _res, next) => {
    rt01Events.push(syntheticEvent('auth', 'login.failed', ++sequence, now()));
    if (rt01Events.length > 250) rt01Events.splice(0, rt01Events.length - 250);
    next();
  }, authLimiter, (_req, res) => {
    res.setHeader('X-Phase2-Downstream', 'reached');
    return res.status(401).json({ success: false, error: 'Synthetic login rejection' });
  });

  router.post('/rt02/probe', (req, res) => {
    let downstream = false;
    res.once('finish', () => {
      if (downstream) rt02DownstreamCount += 1;
      else if (res.statusCode === 400) {
        rt02BlockedCount += 1;
        rt02Events.push(syntheticEvent('application', 'request.suspicious', ++sequence, now()));
        if (rt02Events.length > 100) rt02Events.splice(0, rt02Events.length - 100);
      }
    });
    return securityMiddleware(req, res, () => {
      downstream = true;
      res.setHeader('X-Phase2-Downstream', 'reached');
      return res.status(204).end();
    });
  });

  router.post('/rt05/probe', async (_req, res, next) => {
    try {
      const client = createMemoryRevocationClient();
      const service = createAccessRevocationService({ getClient: () => client });
      await service.revokeAccessSession('phase2-target-session', 300);
      const targetRevoked = await service.isAccessSessionRevoked({ sid: 'phase2-target-session' });
      const otherRevoked = await service.isAccessSessionRevoked({ sid: 'phase2-other-session' });
      const passed = targetRevoked === true && otherRevoked === false && client.size() === 1;
      if (passed) rt05PassCount += 1;
      return res.status(passed ? 200 : 500).json({
        test: 'RT05',
        status: passed ? 'pass' : 'fail',
        backend: 'ephemeral-memory',
        targetRevoked,
        otherRevoked,
        storedKeyCount: client.size(),
        productionWrite: false
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/rt06/guardrail', (_req, res) => {
    const events = Array.from({ length: 5 }, (_, index) => syntheticEvent('auth', 'admin.login.failed', ++sequence, now()));
    const finding = detection.evaluate(events, now()).find(item => item.ruleId === 'DET-ADMIN-FAILED-BURST');
    const policy = evaluateAiPolicy({
      prioritySuggestion: 'P0',
      recommendedActions: ['propose_session_revocation', 'propose_endpoint_isolation'],
      requiresHumanReview: true
    });
    const boundary = buildExecutionBoundary({
      state: 'approved',
      approvalId: 'phase2-deployed-synthetic-approval',
      action: 'propose_endpoint_isolation',
      priority: 'P0'
    }, { now });
    const passed = finding?.severity === 'critical'
      && policy.decision === 'escalate'
      && policy.executable === false
      && boundary.authorized === false
      && boundary.executable === false
      && boundary.actionRunnerAvailable === false;
    if (passed) rt06PassCount += 1;
    return res.status(passed ? 200 : 500).json({
      test: 'RT06',
      status: passed ? 'pass' : 'fail',
      finding: finding ? { ruleId: finding.ruleId, severity: finding.severity } : null,
      policyDecision: policy.decision,
      humanReviewRequired: true,
      freezeAttempted: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });
  });

  router.get('/evidence', (_req, res) => {
    const rt01Finding = detection.evaluate(rt01Events, now()).find(item => item.ruleId === 'DET-AUTH-FAILED-BURST');
    const rt02Finding = detection.evaluate(rt02Events, now()).find(item => item.ruleId === 'DET-SUSPICIOUS-REQUEST');
    return res.json({
      version: SECURITY_PHASE2_DEPLOYED_HARNESS_VERSION,
      productionTouched: false,
      databaseWriterAllowed: false,
      actionRunnerAvailable: false,
      executable: false,
      RT01: {
        observedAttempts: rt01Events.length,
        finding: rt01Finding ? { ruleId: rt01Finding.ruleId, severity: rt01Finding.severity } : null
      },
      RT02: {
        blockedBeforeDownstream: rt02BlockedCount,
        downstreamReached: rt02DownstreamCount,
        finding: rt02Finding ? { ruleId: rt02Finding.ruleId, severity: rt02Finding.severity } : null
      },
      RT05: { deployedSyntheticPassCount: rt05PassCount, backend: 'ephemeral-memory' },
      RT06: { deployedGuardrailPassCount: rt06PassCount, freezeAttempted: false }
    });
  });

  return router;
}

function mountSecurityPhase2DeployedHarness({ app, env = process.env, now = () => new Date() } = {}) {
  const config = buildSecurityPhase2DeployedHarnessConfig(env);
  if (!config.enabled) return publicHarnessStatus(config, 'disabled');
  if (!config.ready) {
    const error = new Error('SECURITY_PHASE2_DEPLOYED_HARNESS_BLOCKED');
    error.code = 'SECURITY_PHASE2_DEPLOYED_HARNESS_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }
  if (!app || typeof app.use !== 'function') throw new TypeError('Express app.use is required');
  const router = createSecurityPhase2DeployedHarnessRouter({ env, now });
  app.use(config.prefix, router);
  return publicHarnessStatus(config, 'mounted');
}

module.exports = {
  SECURITY_PHASE2_DEPLOYED_HARNESS_VERSION,
  SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX,
  buildSecurityPhase2DeployedHarnessConfig,
  createSecurityPhase2DeployedHarnessRouter,
  mountSecurityPhase2DeployedHarness
};
