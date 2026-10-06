const { buildSecurityStagingIsolationConfig } = require('./securityStagingIsolation');
const { createSecurityCenterRouter } = require('./securityCenterRouter');
const { SecurityCenterService } = require('./securityCenterService');
const { MemorySecurityStore } = require('./securityStore');
const { SecurityApprovalGate } = require('./securityApprovalGate');
const { BoundaryAudit } = require('./securityBoundaryAudit');

const SECURITY_CENTER_MOUNT_VERSION = 'v0.86';
const SECURITY_CENTER_DEFAULT_PREFIX = '/api/security-center';

function safePrefix(value) {
  const prefix = String(value || SECURITY_CENTER_DEFAULT_PREFIX).trim();
  if (!/^\/api\/[A-Za-z0-9/_-]{1,80}$/.test(prefix) || prefix.includes('..') || prefix.endsWith('/')) return null;
  return prefix;
}

function buildSecurityCenterMountConfig(env = {}) {
  const enabled = env.SECURITY_CENTER_RUNTIME_ENABLED === 'true';
  const prefix = safePrefix(env.SECURITY_CENTER_RUNTIME_PREFIX);
  const isolation = buildSecurityStagingIsolationConfig(env);
  const blockers = [];

  if (enabled) {
    if (isolation.required !== true) blockers.push('staging_isolation_not_required');
    if (isolation.ready !== true) blockers.push('staging_isolation_not_ready');
    if (!prefix) blockers.push('mount_prefix_invalid');
  }

  return Object.freeze({
    version: SECURITY_CENTER_MOUNT_VERSION,
    enabled,
    ready: enabled && blockers.length === 0,
    prefix: prefix || SECURITY_CENTER_DEFAULT_PREFIX,
    isolation: Object.freeze({
      required: isolation.required === true,
      ready: isolation.ready === true,
      environmentClass: isolation.environmentClass,
      stagingId: isolation.stagingId,
      runtimeMode: isolation.runtimeMode,
      databaseWriterAllowed: false,
      actionRunnerAvailable: false
    }),
    readOnly: true,
    adminOnly: true,
    authorized: false,
    executable: false,
    actionRunnerAvailable: false,
    blockers: Object.freeze([...new Set(blockers)])
  });
}

function createReadOnlySecurityCenterService({ now = () => new Date() } = {}) {
  if (typeof now !== 'function') throw new TypeError('security center clock required');
  const store = new MemorySecurityStore({ retentionMs: 24 * 60 * 60 * 1000, maxIncidents: 1000 });
  const approvalGate = new SecurityApprovalGate({ now, maxRecords: 100 });
  const boundaryAudit = new BoundaryAudit({ now, maxRecords: 100 });
  const runner = Object.freeze({
    status() {
      return Object.freeze({
        version: SECURITY_CENTER_MOUNT_VERSION,
        state: 'mounted_read_only',
        enabled: false,
        running: false,
        mode: 'shadow',
        authorized: false,
        executable: false,
        actionRunnerAvailable: false
      });
    }
  });
  return new SecurityCenterService({
    runner,
    store,
    approvalGate,
    boundaryAudit,
    sourceName: 'security-staging',
    staleAfterMs: 10 * 60 * 1000
  });
}

function publicMountStatus(config, state) {
  return Object.freeze({
    version: SECURITY_CENTER_MOUNT_VERSION,
    state,
    enabled: config.enabled,
    ready: config.ready,
    prefix: config.prefix,
    environmentClass: config.isolation.environmentClass,
    stagingId: config.isolation.stagingId,
    readOnly: true,
    adminOnly: true,
    authorized: false,
    executable: false,
    actionRunnerAvailable: false,
    blockers: config.blockers
  });
}

function mountSecurityCenterRuntime({
  app,
  env = process.env,
  verifyToken,
  requireAdmin,
  adminLimiter = null,
  service = null,
  now = () => new Date()
} = {}) {
  const config = buildSecurityCenterMountConfig(env);
  if (!config.enabled) return publicMountStatus(config, 'disabled');
  if (!config.ready) {
    const error = new Error('SECURITY_CENTER_MOUNT_BLOCKED');
    error.code = 'SECURITY_CENTER_MOUNT_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }
  if (!app || typeof app.use !== 'function') throw new TypeError('Express app.use is required');
  if (typeof verifyToken !== 'function' || typeof requireAdmin !== 'function') throw new TypeError('admin auth middleware required');
  if (adminLimiter !== null && typeof adminLimiter !== 'function') throw new TypeError('admin limiter must be a middleware function');

  const readService = service || createReadOnlySecurityCenterService({ now });
  const router = createSecurityCenterRouter({ service: readService, verifyToken, requireAdmin });
  if (adminLimiter) app.use(config.prefix, adminLimiter, router);
  else app.use(config.prefix, router);
  return publicMountStatus(config, 'mounted');
}

module.exports = {
  SECURITY_CENTER_MOUNT_VERSION,
  SECURITY_CENTER_DEFAULT_PREFIX,
  buildSecurityCenterMountConfig,
  createReadOnlySecurityCenterService,
  mountSecurityCenterRuntime
};
