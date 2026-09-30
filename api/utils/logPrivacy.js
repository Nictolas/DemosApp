const DIRECT_IDENTIFIER_KEYS = new Set([
  'userId',
  'user_id',
  'ipAddress',
  'ip_address',
  'userAgent',
  'user_agent',
  'sessionId',
  'session_id'
]);

const isExplicitAuditOrSecurityEvent = (meta = {}) =>
  meta.auditEvent === true || meta.securityEvent === true;

const sanitizeLogMeta = (meta = {}) => {
  if (!meta || typeof meta !== 'object') return {};
  if (isExplicitAuditOrSecurityEvent(meta)) return { ...meta };

  return Object.fromEntries(
    Object.entries(meta).filter(([key]) => !DIRECT_IDENTIFIER_KEYS.has(key))
  );
};

module.exports = {
  DIRECT_IDENTIFIER_KEYS,
  isExplicitAuditOrSecurityEvent,
  sanitizeLogMeta
};
