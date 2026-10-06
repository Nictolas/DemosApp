const express = require('express');
const rateLimit = require('express-rate-limit');
const { buildSecurityCenterMountConfig, mountSecurityCenterRuntime } = require('./securityCenterMount');
const { buildSecurityCenterStagingAuthConfig, createSecurityCenterStagingAuth } = require('./securityCenterStagingAuth');
const { buildSecurityPhase2DeployedHarnessConfig, mountSecurityPhase2DeployedHarness } = require('./securityPhase2DeployedHarness');

const SECURITY_CENTER_STAGING_SERVER_VERSION = 'v0.99';
const DEFAULT_PORT = 3001;

function parsePort(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_PORT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return null;
  return parsed;
}

function buildSecurityCenterStagingServerConfig(env = {}) {
  const enabled = env.SECURITY_STAGING_SERVER_ENABLED === 'true';
  const port = parsePort(env.PORT);
  const mount = buildSecurityCenterMountConfig(env);
  const auth = buildSecurityCenterStagingAuthConfig(env);
  const phase2 = buildSecurityPhase2DeployedHarnessConfig(env);
  const blockers = [];

  if (enabled) {
    if (env.NODE_ENV !== 'production') blockers.push('node_env_not_hardened');
    if (!port) blockers.push('port_invalid');
    if (mount.enabled !== true || mount.ready !== true) blockers.push('security_center_mount_not_ready');
    if (auth.enabled !== true || auth.ready !== true) blockers.push('staging_auth_not_ready');
    if (phase2.enabled === true && phase2.ready !== true) blockers.push('phase2_validation_not_ready');
  }

  return Object.freeze({
    version: SECURITY_CENTER_STAGING_SERVER_VERSION,
    enabled,
    ready: enabled && blockers.length === 0,
    port: port || DEFAULT_PORT,
    state: enabled && blockers.length === 0 ? 'ready' : 'disabled_or_blocked',
    readOnly: true,
    adminOnly: true,
    databaseRequired: false,
    databaseWriterAllowed: false,
    authorized: false,
    executable: false,
    actionRunnerAvailable: false,
    blockers: Object.freeze([...new Set(blockers)])
  });
}

function securityHeaders(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  return next();
}

function basePublicHealth() {
  return {
    version: SECURITY_CENTER_STAGING_SERVER_VERSION,
    state: 'ready',
    readOnly: true,
    databaseRequired: false,
    authorized: false,
    executable: false,
    actionRunnerAvailable: false
  };
}

async function buildPublicStagingHealth({ service = null, now = () => new Date() } = {}) {
  const base = basePublicHealth();
  if (!service || typeof service.getHealth !== 'function') return base;

  try {
    const detail = await service.getHealth({ now: now() });
    const agent = detail?.agent || {};
    const telemetry = detail?.telemetry || {};
    const lastRunStatus = String(agent.lastRunStatus || 'never').slice(0, 32);
    const runCount = Math.max(0, Number(agent.runCount || 0));
    const failureCount = Math.max(0, Number(agent.failureCount || 0));
    const telemetryStatus = String(telemetry.status || 'unknown').slice(0, 32);
    const state = runCount === 0
      ? 'warming'
      : (lastRunStatus === 'ok' && telemetryStatus === 'healthy' ? 'ready' : 'degraded');

    return {
      ...base,
      state,
      agent: {
        enabled: agent.enabled === true,
        inFlight: agent.inFlight === true,
        lastRunStatus,
        runCount,
        failureCount
      },
      telemetry: {
        status: telemetryStatus,
        lastSuccessAt: telemetry.lastSuccessAt || null,
        consecutiveFailures: Math.max(0, Number(telemetry.consecutiveFailures || 0)),
        polls: Math.max(0, Number(telemetry.totals?.polls || 0))
      }
    };
  } catch (_error) {
    return {
      ...base,
      state: 'degraded',
      agent: { enabled: true, inFlight: false, lastRunStatus: 'error', runCount: 0, failureCount: 1 },
      telemetry: { status: 'error', lastSuccessAt: null, consecutiveFailures: 1, polls: 0 }
    };
  }
}

function createSecurityCenterStagingApp({ env = process.env, now = () => new Date(), service = null } = {}) {
  const config = buildSecurityCenterStagingServerConfig(env);
  if (!config.enabled || !config.ready) {
    const error = new Error('SECURITY_CENTER_STAGING_SERVER_BLOCKED');
    error.code = 'SECURITY_CENTER_STAGING_SERVER_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);

  app.get('/healthz', async (_req, res) => {
    const payload = await buildPublicStagingHealth({ service, now });
    return res.json(payload);
  });

  const auth = createSecurityCenterStagingAuth(env);
  const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Troppe richieste' }
  });

  mountSecurityCenterRuntime({
    app,
    env,
    verifyToken: auth.verifyToken,
    requireAdmin: auth.requireAdmin,
    adminLimiter,
    service,
    now
  });

  mountSecurityPhase2DeployedHarness({ app, env, now });

  app.use((_req, res) => res.status(404).json({ success: false, error: 'Route non trovata' }));
  app.use((_error, _req, res, _next) => res.status(500).json({ success: false, error: 'Errore interno del server' }));
  return app;
}

function startSecurityCenterStagingServer({ env = process.env, service = null } = {}) {
  const config = buildSecurityCenterStagingServerConfig(env);
  if (!config.enabled || !config.ready) {
    const error = new Error('SECURITY_CENTER_STAGING_SERVER_BLOCKED');
    error.code = 'SECURITY_CENTER_STAGING_SERVER_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }
  const app = createSecurityCenterStagingApp({ env, service });
  return app.listen(config.port, '0.0.0.0', () => {
    console.log(`Security Center staging server listening on port ${config.port}`);
  });
}

if (require.main === module) startSecurityCenterStagingServer();

module.exports = {
  SECURITY_CENTER_STAGING_SERVER_VERSION,
  DEFAULT_PORT,
  parsePort,
  buildSecurityCenterStagingServerConfig,
  buildPublicStagingHealth,
  createSecurityCenterStagingApp,
  startSecurityCenterStagingServer
};
