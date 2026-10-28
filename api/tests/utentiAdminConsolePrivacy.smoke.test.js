'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression for GH-184: no browser-console disclosure of admin-loaded
// user objects, email addresses, session metadata or raw error objects.
// The admin UI still displays errors through the existing toast mechanism.
test('admin users page never writes personal data to browser console', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../client/src/pages/Utenti/index.tsx'), 'utf8'
  );
  assert.doesNotMatch(source, /\bconsole\.(?:log|debug|info|warn|error)\s*\(/,
    'admin users page must not print user objects or raw errors');
  assert.match(source, /const handleEdit = \(user: any\) => \{/);
  assert.match(source, /setSelectedUser\(user\)/);
  assert.match(source, /await forceTokenRefresh\(\)/);
  assert.match(source, /clearAllTokens\(\)/);
  assert.match(source, /description: \"Errore nel salvataggio delle modifiche\"/);
});
