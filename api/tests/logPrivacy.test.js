const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeLogMeta,
  minimizeOperationalPath,
  safeDiagnosticCode
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
    endpoint: '/api/users',
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

test('technical request paths contain no user IDs, email, secrets, query strings or political-choice identifiers', () => {
  assert.equal(minimizeOperationalPath('/api/opinioni/82151242-388f-4a97-9d43-2de695ca5edb?token=secret'), '/api/opinioni');
  assert.equal(minimizeOperationalPath('/api/users/12345/export'), '/api/users');
  assert.equal(minimizeOperationalPath('/api/grazia/Marco%40example.com/vota'), '/api/grazia');
  assert.equal(minimizeOperationalPath('/api/unknown/Nicolas/personal'), '/api/other');
  assert.equal(minimizeOperationalPath('/users/nicolas@example.com'), '/web');
  assert.equal(minimizeOperationalPath(null), '/unclassified');
  assert.equal(minimizeOperationalPath('/api/health'), '/api/health');
});

test('operational error details cannot persist arbitrary exception messages and stacks', () => {
  const result = sanitizeLogMeta({
    endpoint: '/api/admin/users/123',
    url: '/api/users/secret@example.com',
    path: '/api/opinioni/1234',
    error: {name: 'Error', message: 'token private data', stack: 'sensitive stack', code: 'INVALID_INPUT'},
    userId: 'sensitive-id'
  });
  assert.deepEqual(result, {
    endpoint: '/api/admin',
    url: '/api/users',
    path: '/api/opinioni',
    error: {code:'INVALID_INPUT'}
  });
  assert.equal(safeDiagnosticCode('user@example.com'), 'UNCLASSIFIED');
  assert.equal(safeDiagnosticCode('INTERNAL_ERROR'), 'INTERNAL_ERROR');
});

test('security and audit events retain their purpose-limited metadata (different approval applies)', () => {
  const event = {auditEvent:true,endpoint:'/api/users/1',userId:'user-1'};
  assert.deepEqual(sanitizeLogMeta(event), event);
});
