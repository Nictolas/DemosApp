const crypto = require('crypto');

const ALLOWED_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const MAX_STRING_LENGTH = 512;
const MAX_META_KEYS = 24;

const FORBIDDEN_KEY_PATTERN = /(?:password|passwd|secret|token|authorization|cookie|fiscal|codice.?fiscale|email|opinion|politic|participant.?id|account.?id|user.?id|session.?id|request.?body|raw.?body|payload)/i;

function sanitizeString(value) {
  const normalized = String(value).replace(/[\r\n\t]+/g, ' ').trim();
  return normalized.slice(0, MAX_STRING_LENGTH);
}

function sanitizeMeta(meta = {}) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return {};
  }

  const safe = {};
  for (const [key, value] of Object.entries(meta).slice(0, MAX_META_KEYS)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      safe[key] = typeof value === 'string' ? sanitizeString(value) : value;
    }
  }
  return safe;
}

function normalizeSecurityEvent(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('security event must be an object');
  }

  const source = sanitizeString(input.source || 'unknown');
  const type = sanitizeString(input.type || 'unknown');
  const category = sanitizeString(input.category || 'security');
  const severity = String(input.severity || 'info').toLowerCase();

  if (!source || !type) {
    throw new Error('security event source and type are required');
  }
  if (!ALLOWED_SEVERITIES.has(severity)) {
    throw new Error(`unsupported security event severity: ${severity}`);
  }

  return Object.freeze({
    eventId: input.eventId ? sanitizeString(input.eventId) : crypto.randomUUID(),
    timestamp: input.timestamp ? new Date(input.timestamp).toISOString() : now.toISOString(),
    source,
    type,
    category,
    severity,
    environment: sanitizeString(input.environment || 'unknown'),
    asset: sanitizeString(input.asset || 'unknown'),
    meta: Object.freeze(sanitizeMeta(input.meta))
  });
}

module.exports = {
  ALLOWED_SEVERITIES,
  FORBIDDEN_KEY_PATTERN,
  normalizeSecurityEvent,
  sanitizeMeta
};
