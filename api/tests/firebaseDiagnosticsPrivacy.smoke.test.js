'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'comunicazioni.js'), 'utf8');

function between(start, end) {
  const s = source.indexOf(start);
  assert.notEqual(s, -1, `missing ${start}`);
  const e = source.indexOf(end, s + start.length);
  assert.notEqual(e, -1, `missing ${end}`);
  return source.slice(s, e);
}

test('Firebase diagnostics is Admin-only and never exposes credential fragments', () => {
  const block = between(
    "router.get('/debug-firebase-admin', verifyToken, requireAdmin",
    "module.exports = router;",
  );
  assert.doesNotMatch(block, /FIREBASE_PRIVATE_KEY\.substring/);
  assert.doesNotMatch(block, /testToken\.substring/);
  assert.doesNotMatch(block, /client_email_actual:\s*process\.env\.FIREBASE_CLIENT_EMAIL/);
  assert.doesNotMatch(block, /valore_completo:\s*process\.env\.FIREBASE_CLIENT_EMAIL/);
  assert.match(block, /valore:\s*process\.env\.FIREBASE_PRIVATE_KEY \? 'Presente \(nascosto\)'/);
  assert.match(block, /client_email_present:\s*!!process\.env\.FIREBASE_CLIENT_EMAIL/);
});
