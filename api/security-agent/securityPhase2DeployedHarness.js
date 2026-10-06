const crypto = require('node:crypto');
const express = require('express');
const { createAuthLimiter } = require('../middleware/rateLimiting');
const { securityMiddleware } = require('../middleware/security');
const { createAccessRevocationService } = require('../services/accessRevocationService');
const { DetectionEngine } = require('./detectionEngine');
const { evaluateAiPolicy } = require('./securityPolicyEngine');
const { buildExecutionBoundary } = require('./securityExecutionBoundary');
const { buildSecurityStagingIsolationConfig } = require('./securityStagingIsolation');
const { buildSecurityPhase2RenderKvConfig, createSecurityPhase2RenderKvClient } = require('./securityPhase2RenderKv');

const SECURITY_PHASE2_DEPLOYED_HARNESS_VERSION = 'v0.101';
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
  const renderKv = buildSecurityPhase2RenderKvConfig(env);
  const blockers = [];

  if (enabled) {
    if (isolation.required !== true) blockers.push('staging_isolation_not_required');
    if (isolation.ready !== true) blockers.push('staging_isolation_not_ready');
    if (isolation.environmentClass !== 'staging') blockers.push('environment_class_not_staging');
    if (isolation.runtimeMode !== 'memory') blockers.push('runtime_not_memory');
    if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) blockers.push('validation_token_invalid');
    if (renderKv.enabled === true && renderKv.ready !== true) blockers.push(...renderKv.blockers.map(code => `render_kv:${code}`));
  }

  return Object.freeze({
    version: SECURITY_PHASE2_DEPLOYED_HARNESS_VERSION,
    enabled,
    ready: enabled && blockers.length === 0,
    prefix: SECURITY_PHASE2_DEPLOYED_HARNESS_PREFIX,
    readOnlyProduction: true,
    syntheticStateOnly: true,
    renderKv: Object.freeze({
      enabled: renderKv.enabled === true,
      ready: renderKv.ready === true,
      renderKvId: renderKv.renderKvId || null,
      privateNetworkOnly: renderKv.privateNetworkOnly === true,
      productionWriteAllowed: false
    }),
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
    async del(key) { return data.delete(key) ? 1 : 0; },
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
    renderKv: config.renderKv,
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
  const rt01Limiter = createAuthLimiter({
    keyGenerator: req => {
      const source = String(req.get('x-phase2-source') || 'default').trim().toLowerCase();
      const safe = source.replace(/[^a-z0-9_.:-]/g, '_').slice(0, 64) || 'default';
      return `phase2-validation:${safe}`;
    }
  });
  const rt01Events = [];
  const rt02Events = [];
  let rt02BlockedCount = 0;
  let rt02DownstreamCount = 0;
  let rt05PassCount = 0;
  let rt05Backend = config.renderKv.enabled ? 'render-key-value' : 'ephemeral-memory';
  let rt05CleanupConfirmed = false;
  let rt06PassCount = 0;
  let sequence = 0;

  router.use(express.json({ limit: '16kb' }));
  router.use(auth);

  router.get('/status', (_req, res) => res.json(publicHarnessStatus(config, 'ready')));

  router.post('/rt01/login', (req, _res, next) => {
    rt01Events.push(syntheticEvent('auth', 'login.failed', ++sequence, now()));
    if (rt01Events.length > 250) rt01Events.splice(0, rt01Events.length - 250);
    next();
  }, rt01Limiter, (_req, res) => {
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
    let client = null;
    try {
      const usingRenderKv = config.renderKv.enabled === true;
      client = usingRenderKv
        ? createSecurityPhase2RenderKvClient({ env })
        : createMemoryRevocationClient();
      if (usingRenderKv) await client.connect();

      const service = createAccessRevocationService({ getClient: () => client });
      const nonce = crypto.randomUUID();
      const targetSession = `phase2-target-${nonce}`;
      const otherSession = `phase2-other-${nonce}`;
      const targetKey = require('../config/cacheKeys').keys.revokedAccessSession(targetSession);
      await service.revokeAccessSession(targetSession, 60);
      const targetRevoked = await service.isAccessSessionRevoked({ sid: targetSession });
      const otherRevoked = await service.isAccessSessionRevoked({ sid: otherSession });
      await client.del(targetKey);
      const cleanupConfirmed = !(await service.isAccessSessionRevoked({ sid: targetSession }));
      const storedKeyCount = usingRenderKv ? null : client.size();
      const passed = targetRevoked === true && otherRevoked === false && cleanupConfirmed === true
        && (usingRenderKv || storedKeyCount === 0);
      rt05Backend = usingRenderKv ? 'render-key-value' : 'ephemeral-memory';
      rt05CleanupConfirmed = cleanupConfirmed;
      if (passed) rt05PassCount += 1;
      return res.status(passed ? 200 : 500).json({
        test: 'RT05',
        status: passed ? 'pass' : 'fail',
        backend: rt05Backend,
        targetRevoked,
        otherRevoked,
        cleanupConfirmed,
        storedKeyCount,
        privateNetworkOnly: usingRenderKv ? true : null,
        productionWrite: false
      });
    } catch (error) {
      return next(error);
    } finally {
      if (client && typeof client.disconnect === 'function') {
        try { client.disconnect(); } catch (_disconnectError) {}
      }
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
      RT05: { deployedSyntheticPassCount: rt05PassCount, backend: rt05Backend, cleanupConfirmed: rt05CleanupConfirmed },
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
