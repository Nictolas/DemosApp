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
