const test = require('node:test');
const assert = require('node:assert/strict');
const { safeAuditErrorCode, buildAxiomAuditEvent } = require('../utils/axiomAuditEvent');

test('audit payload is explicitly categorized and keeps the minimal approved fields', () => {
  const record = buildAxiomAuditEvent({
    timestamp: new Date('2026-10-21T10:00:00.000Z'),
    user_id: 'user-123',
    action: 'CONSENT_CHANGE',
    resource: 'political_opinions',
    resource_id: 'record-3',
    success: true,
    ip_address: '192.0.2.1',
    details: { politicalOpinion: 'sensitive' }
  });

  assert.equal(record._time, '2026-10-21T10:00:00.000Z');
  assert.equal(record.log_type, 'audit');
  assert.equal(record.user_id, 'user-123');
  assert.equal(record.action, 'CONSENT_CHANGE');
  assert.equal(record.session_id, null, 'never synthesize cross-request session IDs');
  assert.ok(!('details' in record));
  assert.ok(!JSON.stringify(record).includes('sensitive'));
});

test('audit payload keeps an explicit session identifier but does not derive one', () => {
  const record = buildAxiomAuditEvent({
    timestamp: '2026-10-21T10:00:00.000Z',
    session_id: 'session-from-auth',
    success: false
  });
  assert.equal(record.session_id, 'session-from-auth');
  assert.equal(record.success, false);
});

test('raw error messages containing identifying text are not sent to Axiom', () => {
  assert.equal(safeAuditErrorCode('NOT_AUTHORIZED'), 'NOT_AUTHORIZED');
  assert.equal(safeAuditErrorCode('http:401'), null);
  assert.equal(safeAuditErrorCode('User email is alice@example.org'), null);
  assert.equal(safeAuditErrorCode('token=abc.def.ghi'), null);
  assert.equal(safeAuditErrorCode(null), null);
  const record = buildAxiomAuditEvent({ error_message: 'User email is alice@example.org' });
  assert.equal(record.error_message, null);
});
