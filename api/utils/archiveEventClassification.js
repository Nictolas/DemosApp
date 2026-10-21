'use strict';

// Classification drives independently configured storage lifecycles.
// Keep backwards compatibility for pre-tagging Axiom records.
function classifyRecord(record) {
  if (record?.log_type === 'security' || record?.securityEvent === true) return 'security';
  if (record?.log_type === 'audit' || record?.auditEvent === true) return 'audit';
  if (record && record.type && record.severity) return 'security';
  if (record && record.action && record.resource) return 'audit';
  if (typeof record?.message === 'string') {
    if (record.message.startsWith('Evento di sicurezza: ')) return 'security';
    if (record.message.startsWith('Audit: ')) return 'audit';
  }
  return 'technical';
}

module.exports = { classifyRecord };
