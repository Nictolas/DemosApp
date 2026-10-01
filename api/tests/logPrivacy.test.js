const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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


const readRoute = (...parts) => fs.readFileSync(path.join(__dirname, '..', 'routes', ...parts), 'utf8');

test('sensitive operational routes do not write direct identity or political-position values to console logs', () => {
  const sources = [
    readRoute('users', 'profile.js'),
    readRoute('opinioni', 'user-answers.js'),
    readRoute('user', 'political-opinions-consent.js'),
    readRoute('user', 'gdpr-rights.js')
  ].join('\n');

  const forbidden = [
    /console\.(?:log|warn|error)\([^\n;]*,\s*userId\s*\)/,
    /console\.(?:log|warn|error)\([^\n;]*\$\{userId\}/,
    /console\.(?:log|warn|error)\([^\n;]*,\s*user\.email\s*\)/,
    /console\.(?:log|warn|error)\([^\n;]*,\s*updatedUser\.email\s*\)/,
    /console\.(?:log|warn|error)\([^\n;]*\$\{dbValue\}/,
    /console\.(?:log|warn|error)\([^\n;]*,\s*opinioni\s*\)/,
    /console\.(?:log|warn|error)\([^\n;]*,\s*fonti\s*\)/
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(sources, pattern);
  }
});


test('matching paths do not log identity-linked opinion vectors or political selections', () => {
  const backendSources = [
    readRoute('rappresentanti.js'),
    readRoute('candidati.js'),
    readRoute('opinioni', 'compatibility.js')
  ].join('\n');

  const clientSources = [
    fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'ScegliRappresentante', 'hooks', 'useRappresentantiData.ts'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'ScegliCandidato', 'hooks', 'useCandidatiData.ts'), 'utf8')
  ].join('\n');

  const forbiddenBackend = [
    /console\.(?:log|warn|error)\([^\n;]*\$\{userId\}/,
    /console\.(?:log|warn|error)\([^\n;]*,\s*userId\s*\)/,
    /console\.(?:log|warn|error)\([^\n;]*userOpinions/,
    /console\.(?:log|warn|error)\([^\n;]*userValue/,
    /console\.(?:log|warn|error)\([^\n;]*candidatoValue/,
    /console\.(?:log|warn|error)\([^\n;]*req\.headers/,
    /console\.(?:log|warn|error)\([^\n;]*rappresentantiSelezionati/,
    /console\.(?:log|warn|error)\([^\n;]*candidatiSelezionati/
  ];
  for (const pattern of forbiddenBackend) assert.doesNotMatch(backendSources, pattern);

  const forbiddenClient = [
    /console\.log\([^\n;]*response\?\.data/,
    /console\.log\([^\n;]*result\.data/,
    /console\.log\([^\n;]*Candidati array completo/,
    /console\.log\([^\n;]*Utente:/,
    /console\.log\([^\n;]*Candidato selezionato[^\n;]*candidatoSelezionato/,
    /console\.log\([^\n;]*Rappresentante selezionato[^\n;]*utente/
  ];
  for (const pattern of forbiddenClient) assert.doesNotMatch(clientSources, pattern);
});
