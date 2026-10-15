const { securityCenterRouteContract } = require('./securityCenterRouteContract');

const PHASE4_DEPLOYED_VALIDATION_VERSION = 'v0.85';
const VALIDATION_ROUTES = Object.freeze(['/ai-policy', '/approvals', '/boundary-audit']);
const FORBIDDEN_TRUE_KEYS = Object.freeze(['authorized', 'executable', 'actionRunnerAvailable', 'executionEnabled', 'writeAccess']);
const DEFAULT_PREFIX = '/api/security-center';
const DEFAULT_TIMEOUT_MS = 8000;

function enabled(env, key) {
  return env[key] === 'true';
}

function parseHostAllowlist(value) {
  return Object.freeze([...new Set(String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean))]);
}

function parseOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    return url;
  } catch (_error) {
    return null;
  }
}

function safePrefix(value) {
  const prefix = String(value || DEFAULT_PREFIX).trim();
  if (!/^\/[A-Za-z0-9/_-]{1,79}$/.test(prefix) || prefix.includes('..') || prefix.endsWith('/')) return null;
  return prefix;
}

function parseTimeout(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1000 && parsed <= 30000 ? parsed : null;
}

function productionLikeHost(hostname) {
  return /(^|[.-])(prod|production)([.-]|$)/i.test(String(hostname || ''));
}

function buildPhase4DeployedValidationConfig(env = {}) {
  const active = enabled(env, 'SECURITY_PHASE4_DEPLOYED_VALIDATION_ENABLED');
  const origin = parseOrigin(env.SECURITY_PHASE4_STAGING_ORIGIN);
  const prefix = safePrefix(env.SECURITY_PHASE4_SECURITY_CENTER_PREFIX);
  const timeoutMs = parseTimeout(env.SECURITY_PHASE4_VALIDATION_TIMEOUT_MS);
  const hostAllowlist = parseHostAllowlist(env.SECURITY_PHASE4_STAGING_HOST_ALLOWLIST);
  const environmentClass = String(env.SECURITY_AGENT_ENVIRONMENT_CLASS || '').trim().toLowerCase();
  const stagingId = String(env.SECURITY_AGENT_STAGING_ID || '').trim();
  const tokenReady = typeof env.SECURITY_PHASE4_STAGING_ADMIN_TOKEN === 'string' && env.SECURITY_PHASE4_STAGING_ADMIN_TOKEN.length >= 20;
  const blockers = [];

  if (active) {
    if (!enabled(env, 'SECURITY_AGENT_STAGING_ISOLATION_REQUIRED')) blockers.push('staging_isolation_not_required');
    if (environmentClass !== 'staging') blockers.push('environment_not_staging');
    if (!stagingId || !/staging/i.test(stagingId)) blockers.push('staging_id_invalid');
    if (!origin) blockers.push('staging_origin_invalid');
    if (origin && productionLikeHost(origin.hostname)) blockers.push('production_like_host_forbidden');
    if (hostAllowlist.length === 0) blockers.push('staging_host_allowlist_missing');
    if (origin && !hostAllowlist.includes(origin.hostname.toLowerCase())) blockers.push('staging_host_not_allowlisted');
    if (!prefix) blockers.push('security_center_prefix_invalid');
    if (timeoutMs === null) blockers.push('validation_timeout_invalid');
    if (!tokenReady) blockers.push('staging_admin_token_missing');
  }

  const contract = securityCenterRouteContract();
  if (active && (contract.readOnly !== true || contract.adminOnly !== true || contract.methods.length !== 1 || contract.methods[0] !== 'GET')) {
    blockers.push('security_center_contract_not_read_only');
  }
  for (const route of VALIDATION_ROUTES) {
    if (active && !contract.routes.includes(route)) blockers.push('validation_route_not_contracted');
  }

  return Object.freeze({
    version: PHASE4_DEPLOYED_VALIDATION_VERSION,
    enabled: active,
    ready: active && blockers.length === 0,
    origin: origin ? origin.origin : null,
    hostname: origin ? origin.hostname.toLowerCase() : null,
    prefix: prefix || DEFAULT_PREFIX,
    timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    environmentClass: environmentClass || null,
    stagingId: stagingId || null,
    routeCount: VALIDATION_ROUTES.length,
    methods: Object.freeze(['GET']),
    adminCredentialReady: tokenReady,
    authorized: false,
    executable: false,
    actionRunnerAvailable: false,
    blockers: Object.freeze([...new Set(blockers)])
  });
}

function findCapabilityViolations(value, path = '$', out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.slice(0, 500).forEach((item, index) => findCapabilityViolations(item, `${path}[${index}]`, out));
    return out;
  }
  for (const [key, item] of Object.entries(value).slice(0, 500)) {
    const nextPath = `${path}.${key}`;
    if (FORBIDDEN_TRUE_KEYS.includes(key) && item === true) out.push(nextPath);
    if (item && typeof item === 'object') findCapabilityViolations(item, nextPath, out);
    if (out.length >= 20) break;
  }
  return out;
}

function publicResult(config, status, routeResults = [], extra = {}) {
  return Object.freeze({
    version: PHASE4_DEPLOYED_VALIDATION_VERSION,
    status,
    enabled: config.enabled,
    ready: config.ready,
    hostname: config.hostname,
    stagingId: config.stagingId,
    routeCount: config.routeCount,
    checkedCount: routeResults.length,
    routes: Object.freeze(routeResults.map(item => Object.freeze({ ...item }))),
    authorized: false,
    executable: false,
    actionRunnerAvailable: false,
    blockers: config.blockers,
    ...extra
  });
}

async function fetchRoute({ fetchImpl, url, token, stagingId, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-DEMOS-Staging-ID': stagingId
      }
    });
    if (!response || response.ok !== true || response.status !== 200) throw new Error('PHASE4_HTTP_FAILED');
    const data = await response.json();
    const violations = findCapabilityViolations(data);
    return Object.freeze({ ok: violations.length === 0, httpStatus: 200, violationCount: violations.length });
  } finally {
    clearTimeout(timer);
  }
}

async function runPhase4DeployedValidation({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = buildPhase4DeployedValidationConfig(env);
  if (!config.enabled) return publicResult(config, 'disabled');
  if (!config.ready) return publicResult(config, 'blocked');
  if (typeof fetchImpl !== 'function') return publicResult(config, 'blocked', [], { errorCode: 'FETCH_UNAVAILABLE' });

  const token = env.SECURITY_PHASE4_STAGING_ADMIN_TOKEN;
  const routeResults = [];
  try {
    for (const route of VALIDATION_ROUTES) {
      const url = `${config.origin}${config.prefix}${route}?limit=20`;
      const result = await fetchRoute({ fetchImpl, url, token, stagingId: config.stagingId, timeoutMs: config.timeoutMs });
      routeResults.push(Object.freeze({ route, ...result }));
      if (!result.ok) return publicResult(config, 'rejected', routeResults, { errorCode: 'EXECUTION_CAPABILITY_DETECTED' });
    }
    return publicResult(config, 'accepted', routeResults);
  } catch (_error) {
    return publicResult(config, 'error', routeResults, { errorCode: 'PHASE4_DEPLOYED_VALIDATION_FAILED' });
  }
}

module.exports = {
  PHASE4_DEPLOYED_VALIDATION_VERSION,
  VALIDATION_ROUTES,
  FORBIDDEN_TRUE_KEYS,
  DEFAULT_PREFIX,
  DEFAULT_TIMEOUT_MS,
  buildPhase4DeployedValidationConfig,
  findCapabilityViolations,
  runPhase4DeployedValidation
};
