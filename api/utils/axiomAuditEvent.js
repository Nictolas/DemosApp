'use strict';

// Build a minimal audit event without inferring a session identifier from user ID.
// Log classifications are required for independent, purpose-limited retention.
function safeAuditErrorCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  return /^[A-Z][A-Z0-9_:-]{0,63}$/.test(code) ? code : null;
}

function buildAxiomAuditEvent(audit, now = Date.now()) {
  return {
    _time: new Date(audit.timestamp || now).toISOString(),
    log_type: 'audit',
    user_id: audit.user_id || null,
    ip_address: audit.ip_address || null,
    action: audit.action || null,
    resource: audit.resource || null,
    resource_id: audit.resource_id || null,
    success: audit.success === undefined ? null : audit.success,
    // Raw error messages may contain tokens, emails, personal data or query values.
    // Keep only controlled, short diagnostic codes.
    error_message: safeAuditErrorCode(audit.error_message),
    // Never create artificial "session IDs" from user identifiers.
    session_id: audit.session_id || null
  };
}

module.exports = { safeAuditErrorCode, buildAxiomAuditEvent };
