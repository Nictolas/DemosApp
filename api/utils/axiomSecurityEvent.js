'use strict';

// Explicit security events use a dedicated purpose-limited outbox payload.
// Never persist free-text security messages, request bodies, URLs, patterns or
// unbounded metadata; they may contain identifiers or user-supplied content.
function safeSecurityCode(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value)
    ? value
    : null;
}

function buildQueuedSecurityEvent(logEntry, meta = {}) {
  if (logEntry?.log_type !== 'security') throw new Error('SECURITY_EVENT_INVALID_CATEGORY');
  const knownEventCode = logEntry.message === 'Evento di sicurezza: Tentativo di attacco rilevato'
    ? 'SUSPICIOUS_REQUEST_PATTERN'
    : 'SECURITY_EVENT';
  return {
    _time: logEntry._time,
    log_type: 'security',
    event_code: safeSecurityCode(meta.securityCode) || knownEventCode,
    user_id: logEntry.user_id || null,
    ip_address: logEntry.ip_address || null
  };
}

module.exports = { safeSecurityCode, buildQueuedSecurityEvent };
