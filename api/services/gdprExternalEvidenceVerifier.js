'use strict';

// OPERATOR-ONLY, pure/offline integrity check for a separately anchored
// GDPR ledger capture. No database, network, filesystem, or storage access.
// An HMAC is NOT encryption and cannot prove that every GDPR event was captured.
const crypto = require('node:crypto');

const TYPES = new Set([
  'account_deleted', 'political_consent_revoked', 'political_consent_granted'
]);
const HEX_SHA256 = /^[0-9a-f]{64}$/;
const MAX_EVENTS = 250000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;
const EVENT_FIELDS = Object.freeze([
  'event_key', 'subject_user_id', 'event_type', 'occurred_at', 'details'
]);
const BUNDLE_FIELDS = Object.freeze(['manifest', 'events', 'signature']);

function invalid(code = 'GDPR_EXTERNAL_EVIDENCE_INVALID') {
  const error = new Error(code);
  error.code = code;
  return error;
}

// Never silently discard extra payload fields before checking the signed digest.
// Every own property (including non-enumerable or symbol keys) must be covered.
function hasExactFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length && fields.every(field => {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value');
  });
}

function canonical(value, depth = 0) {
  if (depth > 24) throw invalid();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    // JSON ignores symbol/non-enumerable array members. Reject rather than
    // attest an archive whose complete payload was not covered by the digest.
    if (value.length > 100000 ||
        Reflect.ownKeys(value).length !== value.length + 1) throw invalid();
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor?.enumerable !== true ||
          !Object.hasOwn(descriptor, 'value')) throw invalid();
    }
    return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  }
  if (value && typeof value === 'object' &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const keys = Reflect.ownKeys(value);
    if (keys.length > 2000) throw invalid();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      // Hidden, symbol or accessor properties are not ordinary JSON data.
      if (typeof key !== 'string' || descriptor?.enumerable !== true ||
          !Object.hasOwn(descriptor, 'value')) throw invalid();
    }
    keys.sort();
    return '{' + keys.map(key =>
      JSON.stringify(key) + ':' + canonical(value[key], depth + 1)
    ).join(',') + '}';
  }
  throw invalid();
}

function utcInstant(text) {
  const m = typeof text === 'string' &&
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(text);
  if (!m) throw invalid();
  const ms = m[1] + '.' + (m[2] || '').padEnd(3, '0').slice(0, 3) + 'Z';
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== ms) throw invalid();
  // Normalize for chronological comparisons without losing microsecond precision.
  // Keep each original timestamp unchanged in the signed event payload.
  return {
    millis: date.getTime(),
    orderKey: m[1] + '.' + (m[2] || '').padEnd(6, '0') + 'Z'
  };
}

function normalize(events, capturedAt) {
  if (!Array.isArray(events) || events.length > MAX_EVENTS) throw invalid();
  const seen = new Set();
  let previous = null;
  const tieTypes = new Map();
  return events.map(row => {
    if (!hasExactFields(row, EVENT_FIELDS) ||
        typeof row.event_key !== 'string' || !row.event_key.trim() ||
        typeof row.subject_user_id !== 'string' || !row.subject_user_id.trim() ||
        !TYPES.has(row.event_type) ||
        !row.details || typeof row.details !== 'object' || Array.isArray(row.details) ||
        seen.has(row.event_key)) throw invalid();
    const instant = utcInstant(row.occurred_at);
    if (instant.millis > capturedAt + MAX_FUTURE_MS) throw invalid('GDPR_EXTERNAL_EVIDENCE_FUTURE_EVENT');
    const order = instant.orderKey + '\u0000' + row.event_key;
    if (previous !== null && order <= previous) {
      throw invalid('GDPR_EXTERNAL_EVIDENCE_EVENT_ORDER');
    }
    previous = order;
    seen.add(row.event_key);
    if (row.event_type !== 'account_deleted') {
      const tieKey = row.subject_user_id + '\u0000' + instant.orderKey;
      const earlier = tieTypes.get(tieKey);
      if (earlier && earlier !== row.event_type) {
        throw invalid('GDPR_EXTERNAL_EVIDENCE_AMBIGUOUS_CONSENT');
      }
      tieTypes.set(tieKey, row.event_type);
    }
    // Reject non-JSON details and preserve every field exactly for hashing.
    canonical(row.details);
    return {
      event_key: row.event_key,
      subject_user_id: row.subject_user_id,
      event_type: row.event_type,
      occurred_at: row.occurred_at,
      details: row.details
    };
  });
}

function hash(value) {
  return crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function keyBuffer(secret) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) {
    throw invalid('GDPR_EXTERNAL_EVIDENCE_KEY_REQUIRED');
  }
  return secret;
}

function sealOffline({ events, capturedAt, source, previousSignature = null }, secret) {
  const key = keyBuffer(secret);
  if (typeof source !== 'string' || !/^[a-z0-9_-]{5,80}$/.test(source)) throw invalid();
  if (previousSignature !== null && !HEX_SHA256.test(previousSignature)) throw invalid();
  const captureTime = utcInstant(capturedAt).millis;
  const rows = normalize(events, captureTime);
  const manifest = {
    version: 1,
    source,
    capturedAt,
    previousSignature,
    count: rows.length,
    eventsSha256: hash(rows)
  };
  const signature = crypto.createHmac('sha256', key)
    .update(canonical(manifest), 'utf8').digest('hex');
  return { manifest, events: rows, signature };
}

function verifyOffline(bundle, {
  secret, expectedSignature, expectedSource, expectedPreviousSignature = null,
  now = Date.now(), maxAgeMs = 60 * 60 * 1000
} = {}) {
  const key = keyBuffer(secret);
  if (!hasExactFields(bundle, BUNDLE_FIELDS)) throw invalid();
  const { manifest, events, signature } = bundle;
  if (!manifest || typeof manifest !== 'object' || manifest.version !== 1 ||
      typeof expectedSource !== 'string' || manifest.source !== expectedSource ||
      !HEX_SHA256.test(expectedSignature || '') ||
      !HEX_SHA256.test(signature || '') ||
      (expectedPreviousSignature !== null &&
       !HEX_SHA256.test(expectedPreviousSignature)) ||
      manifest.previousSignature !== expectedPreviousSignature) {
    throw invalid('GDPR_EXTERNAL_EVIDENCE_ANCHOR_MISMATCH');
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || maxAgeMs > MAX_AGE_MS ||
      !Number.isFinite(now)) throw invalid();
  const capturedAtMs = utcInstant(manifest.capturedAt).millis;
  if (capturedAtMs > now + MAX_FUTURE_MS ||
      now - capturedAtMs > maxAgeMs) {
    throw invalid('GDPR_EXTERNAL_EVIDENCE_STALE');
  }
  const rows = normalize(events, capturedAtMs);
  if (!Number.isSafeInteger(manifest.count) || manifest.count !== rows.length ||
      manifest.eventsSha256 !== hash(rows)) {
    throw invalid('GDPR_EXTERNAL_EVIDENCE_DIGEST_MISMATCH');
  }
  const expectedMac = crypto.createHmac('sha256', key)
    .update(canonical(manifest), 'utf8').digest();
  if (!crypto.timingSafeEqual(expectedMac, Buffer.from(signature, 'hex')) ||
      !crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(signature, 'hex'))) {
    throw invalid('GDPR_EXTERNAL_EVIDENCE_SIGNATURE_MISMATCH');
  }
  // Deliberately return no user IDs, details, event keys, or event records.
  return {
    status: 'INTEGRITY_ONLY_NOT_RECOVERY_GO',
    source: expectedSource,
    capturedAt: manifest.capturedAt,
    eventCount: rows.length,
    evidenceDigest: manifest.eventsSha256,
    externalAnchorVerified: true,
    externalLedgerCompletenessAttested: false,
    renderWriterAttested: false,
    recoveryApproved: false
  };
}

module.exports = { sealOffline, verifyOffline };
