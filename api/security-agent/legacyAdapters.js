const crypto = require('crypto');

const SECURITY_TYPE_MAP = Object.freeze({
  failed_login: { type: 'login.failed', category: 'auth' },
  admin_access: { type: 'admin.access', category: 'admin' },
  suspicious_request: { type: 'request.suspicious', category: 'application' },
  brute_force_attempt: { type: 'auth.brute_force', category: 'auth' },
  excessive_admin_access: { type: 'admin.access.excessive', category: 'admin' },
  rate_limit_exceeded: { type: 'rate_limit.triggered', category: 'edge' }
});

const VIOLATION_TYPE_MAP = Object.freeze({
  SECURITY_BREACH: { type: 'security.breach', category: 'security' },
  UNAUTHORIZED_ACCESS: { type: 'access.unauthorized', category: 'access' },
  SUSPICIOUS_ACTIVITY: { type: 'activity.suspicious', category: 'behavior' },
  DATA_BREACH: { type: 'privacy.data_breach', category: 'privacy' },
  CONSENT_VIOLATION: { type: 'privacy.consent_violation', category: 'privacy' },
  RETENTION_VIOLATION: { type: 'privacy.retention_violation', category: 'privacy' },
  AUDIT_FAILURE: { type: 'telemetry.audit_failure', category: 'telemetry' },
  SYSTEM_ERROR: { type: 'system.error', category: 'system' }
});

function normalizeSeverity(value) {
  const severity = String(value || 'info').toLowerCase();
  return ['info', 'low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'info';
}

function normalizeTimestamp(value, now = new Date()) {
  const parsed = value ? new Date(value) : now;
  return Number.isNaN(parsed.getTime()) ? now.toISOString() : parsed.toISOString();
}

function safeTypeFragment(value) {
  const fragment = String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .slice(0, 80);
  return fragment || 'unknown';
}

function stableEventId(prefix, parts) {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(parts))
    .digest('hex')
    .slice(0, 24);
  return `${prefix}:${digest}`;
}

function numberIfFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function pickSafeSecurityMeta(record) {
  const details = record && typeof record.details === 'object' && !Array.isArray(record.details)
    ? record.details
    : {};

  const meta = {};
  const attemptCount = numberIfFinite(details.attempt_count);
  const accessCount = numberIfFinite(details.access_count);
  const statusCode = numberIfFinite(details.status_code);

  if (attemptCount !== undefined) meta.attemptCount = attemptCount;
  if (accessCount !== undefined) meta.accessCount = accessCount;
  if (statusCode !== undefined) meta.statusCode = statusCode;
  if (typeof details.time_window === 'string') meta.timeWindow = details.time_window.slice(0, 64);
  if (typeof details.method === 'string') meta.method = details.method.slice(0, 16).toUpperCase();

  return meta;
}

function pickSafeViolationMeta(violation) {
  const details = violation && typeof violation.details === 'object' && !Array.isArray(violation.details)
    ? violation.details
    : {};

  const meta = {};
  const counters = {
    failed_count: 'failedCount',
    action_count: 'actionCount',
    access_count: 'accessCount',
    total_actions: 'totalActions',
    stale_count: 'staleCount',
    affected_count: 'affectedCount'
  };

  for (const [sourceKey, targetKey] of Object.entries(counters)) {
    const value = numberIfFinite(details[sourceKey]);
    if (value !== undefined) meta[targetKey] = value;
  }

  return meta;
}

function adaptLegacySecurityRecord(record, { environment = 'unknown', now = new Date() } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('legacy security record must be an object');
  }

  const sourceType = safeTypeFragment(record.type);
  const mapped = SECURITY_TYPE_MAP[sourceType] || {
    type: `legacy.${sourceType}`,
    category: 'security'
  };
  const timestamp = normalizeTimestamp(record._time || record.created_at || record.timestamp, now);
  const severity = normalizeSeverity(record.severity);
  const meta = pickSafeSecurityMeta(record);

  return {
    eventId: stableEventId('legacy-security', [timestamp, sourceType, severity, meta]),
    timestamp,
    source: 'demos.security_monitor',
    type: mapped.type,
    category: mapped.category,
    severity,
    environment,
    asset: 'demos-backend',
    meta
  };
}

function adaptLegacyViolation(violation, { environment = 'unknown', now = new Date() } = {}) {
  if (!violation || typeof violation !== 'object' || Array.isArray(violation)) {
    throw new TypeError('legacy violation must be an object');
  }

  const sourceType = String(violation.type || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9_]+/g, '_').slice(0, 80);
  const mapped = VIOLATION_TYPE_MAP[sourceType] || {
    type: `violation.${safeTypeFragment(sourceType)}`,
    category: 'security'
  };
  const timestamp = normalizeTimestamp(violation.timestamp, now);
  const severity = normalizeSeverity(violation.severity);
  const meta = pickSafeViolationMeta(violation);

  return {
    eventId: stableEventId('legacy-violation', [timestamp, sourceType, severity, meta]),
    timestamp,
    source: 'demos.violation_detection',
    type: mapped.type,
    category: mapped.category,
    severity,
    environment,
    asset: 'demos-backend',
    meta
  };
}

module.exports = {
  SECURITY_TYPE_MAP,
  VIOLATION_TYPE_MAP,
  adaptLegacySecurityRecord,
  adaptLegacyViolation
};
