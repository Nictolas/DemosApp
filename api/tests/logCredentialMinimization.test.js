'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('auth profile logging omits access token fragments and user identifiers', () => {
  const source = read('routes/auth/profile.js');
  assert.match(source, /verifyAccessToken\(token\)/);
  assert.match(source, /console\.warn\('AUTH_ME_SCHEMA_FALLBACK'\)/);
  assert.match(source, /console\.error\('AUTH_ME_FAILED'\)/);
  assert.doesNotMatch(source, /Verifica accesso riuscita/);
  assert.doesNotMatch(source, /Token ricevuto:/i);
  assert.doesNotMatch(source, /console\.(?:log|info|debug)\([^\n]*token\.substring/i);
  assert.doesNotMatch(source, /console\.(?:log|info|debug)\([^\n]*decoded\.userId/i);
});

test('Axiom migration logging only reports whether credential is available', () => {
  const source = read('services/axiomMigrationService.js');
  assert.match(source, /Credenziale Axiom disponibile:/);
  assert.doesNotMatch(source, /console\.(?:log|info|debug)\([^\n]*(?:token\.substring|token\.substr|AXIOM_API_TOKEN\.slice)/);
});

test('notification diagnostics never print FCM token prefixes', () => {
  const source = read('routes/comunicazioni.js');
  assert.match(source, /\[omesso\]/);
  assert.doesNotMatch(source, /(?:debugLog|console\.(?:log|debug|info))\([^\n]*(?:token|tokensToSend\[0\])\??\.substring\(0,\s*50\)/i);
  assert.match(source, /admin\.messaging\(\)/);
});


test('CIE identity status and callback log fixed categories, never raw exception details', () => {
  const source = read('routes/auth/identity.js');
  const expectedCodes = [
    'IDENTITY_STATUS_FAILED',
    'CIE_MOCK_START_FAILED',
    'CIE_MOCK_COMPLETE_FAILED',
    'CIE_CALLBACK_FAILED',
    'CIE_CALLBACK_REDIRECT_FAILED'
  ];
  for (const code of expectedCodes) {
    assert.match(source, new RegExp("console\\.error\\('"+code+"'\\)"));
  }
  const logCalls = [...source.matchAll(/console\\.error\\(([^;\\n]*)\\);/g)];
  assert.equal(logCalls.length, 6);
  assert.equal((source.match(/console\\.error\\(/g) || []).length, logCalls.length);
  for (const [, args] of logCalls) {
    assert.match(args, /^'[A-Z_]+'$/);
  }
  assert.doesNotMatch(source, /console\\.(?:error|warn|log)\\([^;\\n]*\\b(?:error|redirectError)\\b/);
});
