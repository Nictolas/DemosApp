const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRecord } = require('../utils/archiveEventClassification');

test('explicitly tagged audit and security events retain their own categories', () => {
  assert.equal(classifyRecord({ log_type: 'audit', message: 'Audit: update su users' }), 'audit');
  assert.equal(classifyRecord({ log_type: 'security', message: 'Evento di sicurezza: failed login' }), 'security');
  assert.equal(classifyRecord({ auditEvent: true }), 'audit');
  assert.equal(classifyRecord({ securityEvent: true }), 'security');
});

test('old Axiom events are classified by historic shape and message prefix', () => {
  assert.equal(classifyRecord({ type: 'failed_login', severity: 'high' }), 'security');
  assert.equal(classifyRecord({ action: 'DATA_ACCESS', resource: 'users' }), 'audit');
  assert.equal(classifyRecord({ message: 'Evento di sicurezza: unusual event' }), 'security');
  assert.equal(classifyRecord({ message: 'Audit: admin access' }), 'audit');
});

test('normal technical logs do not get classified as audit or security', () => {
  assert.equal(classifyRecord({ log_type: 'technical', message: 'GET /api/health' }), 'technical');
  assert.equal(classifyRecord({ level: 'ERROR', message: 'database timeout' }), 'technical');
  assert.equal(classifyRecord(null), 'technical');
});
