const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeLogMeta
} = require('../utils/logPrivacy');

test('operational logs remove direct identity and network identifiers', () => {
  const result = sanitizeLogMeta({
    endpoint: '/api/users/me',
    method: 'GET',
    requestId: 'req-1',
    userId: 'user-1',
    user_id: 'user-1',
    ipAddress: '192.0.2.1',
    ip_address: '192.0.2.1',
    userAgent: 'Example UA',
    user_agent: 'Example UA',
    sessionId: 'session-1',
    session_id: 'session-1'
  });

  assert.deepEqual(result, {
    endpoint: '/api/users/me',
    method: 'GET',
    requestId: 'req-1'
  });
});

test('explicit security logs retain identifiers for the separate security channel', () => {
  const result = sanitizeLogMeta({
    securityEvent: true,
    eventType: 'failed_login',
    ipAddress: '192.0.2.1',
    userId: 'user-1'
  });

  assert.equal(result.ipAddress, '192.0.2.1');
  assert.equal(result.userId, 'user-1');
});

test('explicit audit logs retain identifiers for the separate audit channel', () => {
  const result = sanitizeLogMeta({
    auditEvent: true,
    action: 'ADMIN_OPERATION',
    userId: 'admin-1',
    ipAddress: '192.0.2.1'
  });

  assert.equal(result.userId, 'admin-1');
  assert.equal(result.ipAddress, '192.0.2.1');
});
