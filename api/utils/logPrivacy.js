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

// Keep only a predictable route family in operational logs: path parameters,
// account names, political-choice IDs and arbitrary slugs are not required
// to diagnose service-level HTTP status and latency.
const SAFE_API_FAMILIES = new Set([
  'admin', 'amnistia', 'auth', 'candidati', 'capo-stato', 'comunicazioni',
  'compatibility', 'delete-account', 'download-data', 'dpo', 'eci',
  'elezioni-utente', 'eventi', 'gdpr', 'governo', 'grazia', 'health', 'ice',
  'iniziative-popolari', 'ministero', 'notifiche', 'opinioni', 'rappresentanti',
  'referendum', 'referendum-abrogativi', 'segnalazioni', 'services',
  'sostenitori', 'statistiche', 'user', 'users', 'voti'
]);

function minimizeOperationalPath(value) {
  if (typeof value !== 'string') return '/unclassified';
  // Deliberately avoid URL-decoding: that can turn encoded identifiers into PII.
  const path = value.split(/[?#]/, 1)[0];
  const match = /^\/api\/([a-z][a-z0-9-]{0,47})(?:\/|$)/i.exec(path);
  if (match) {
    const family = match[1].toLowerCase();
    return SAFE_API_FAMILIES.has(family) ? `/api/${family}` : '/api/other';
  }
  return path === '/health' || path === '/api' ? path : '/web';
}

const safeDiagnosticCode = value =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_:-]{0,63}$/.test(value)
    ? value : 'UNCLASSIFIED';

const isExplicitAuditOrSecurityEvent = (meta = {}) =>
  meta.auditEvent === true || meta.securityEvent === true;

const sanitizeLogMeta = (meta = {}) => {
  if (!meta || typeof meta !== 'object') return {};
  if (isExplicitAuditOrSecurityEvent(meta)) return { ...meta };

  const output = Object.fromEntries(
    Object.entries(meta).filter(([key]) => !DIRECT_IDENTIFIER_KEYS.has(key))
  );
  for (const key of ['url', 'endpoint', 'path', 'route']) {
    if (key in output) output[key] = minimizeOperationalPath(output[key]);
  }
  // Arbitrary exception descriptions/stack traces can contain emails, secrets,
  // SQL values and other personal data. Use a controlled code only.
  if (output.error && typeof output.error === 'object') {
    output.error = { code: safeDiagnosticCode(output.error.code) };
  }
  return output;
};

module.exports = {
  DIRECT_IDENTIFIER_KEYS,
  isExplicitAuditOrSecurityEvent,
  sanitizeLogMeta,
  minimizeOperationalPath,
  safeDiagnosticCode
};
