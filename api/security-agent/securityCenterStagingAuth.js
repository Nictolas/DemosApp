const crypto = require('node:crypto');
const { buildSecurityStagingIsolationConfig } = require('./securityStagingIsolation');

const SECURITY_CENTER_STAGING_AUTH_VERSION = 'v0.87';
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 512;

function buildSecurityCenterStagingAuthConfig(env = {}) {
  const enabled = env.SECURITY_CENTER_STAGING_AUTH_ENABLED === 'true';
  const token = String(env.SECURITY_CENTER_STAGING_ADMIN_TOKEN || '');
  const isolation = buildSecurityStagingIsolationConfig(env);
  const blockers = [];

  if (enabled) {
    if (env.NODE_ENV !== 'production') blockers.push('node_env_not_hardened');
    if (isolation.required !== true) blockers.push('staging_isolation_not_required');
    if (isolation.ready !== true || isolation.environmentClass !== 'staging') blockers.push('staging_isolation_not_ready');
    if (token.length < MIN_TOKEN_LENGTH) blockers.push('admin_token_too_short');
    if (token.length > MAX_TOKEN_LENGTH) blockers.push('admin_token_too_long');
  }

  return Object.freeze({
    version: SECURITY_CENTER_STAGING_AUTH_VERSION,
    enabled,
    ready: enabled && blockers.length === 0,
    mode: 'staging_bearer',
    environmentClass: isolation.environmentClass,
    stagingId: isolation.stagingId,
    tokenConfigured: token.length >= MIN_TOKEN_LENGTH && token.length <= MAX_TOKEN_LENGTH,
    adminOnly: true,
    readOnly: true,
    authorized: false,
    executable: false,
    actionRunnerAvailable: false,
    blockers: Object.freeze([...new Set(blockers)])
  });
}

function constantTimeMatch(provided, expected) {
  const a = Buffer.from(String(provided || ''), 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createSecurityCenterStagingAuth(env = {}) {
  const config = buildSecurityCenterStagingAuthConfig(env);
  if (!config.enabled || !config.ready) {
    const error = new Error('SECURITY_CENTER_STAGING_AUTH_BLOCKED');
    error.code = 'SECURITY_CENTER_STAGING_AUTH_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }
  const expectedToken = String(env.SECURITY_CENTER_STAGING_ADMIN_TOKEN);

  const verifyToken = (req, res, next) => {
    const header = String(req?.headers?.authorization || '');
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!provided || !constantTimeMatch(provided, expectedToken)) {
      return res.status(401).json({ success: false, error: 'Token di accesso richiesto' });
    }
    req.securityCenterStagingAuth = true;
    req.user = Object.freeze({ id: 'security-staging-validator', role: 'AD', status: 'a' });
    req.userId = 'security-staging-validator';
    req.userRole = 'AD';
    return next();
  };

  const requireAdmin = (req, res, next) => {
    if (req.securityCenterStagingAuth !== true || req.userRole !== 'AD') {
      return res.status(403).json({ success: false, error: 'Accesso negato' });
    }
    return next();
  };

  return Object.freeze({ config, verifyToken, requireAdmin });
}

module.exports = {
  SECURITY_CENTER_STAGING_AUTH_VERSION,
  MIN_TOKEN_LENGTH,
  MAX_TOKEN_LENGTH,
  buildSecurityCenterStagingAuthConfig,
  constantTimeMatch,
  createSecurityCenterStagingAuth
};
