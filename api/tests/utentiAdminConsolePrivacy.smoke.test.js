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
  assert.match(source, /await forceTokenRefresh\(\)/);
  assert.match(source, /clearAllTokens\(\)/);
  assert.match(source, /Le modifiche ai dati non sono disponibili in questa pagina/);
});

test('admin directory remains read-only without pending approvals', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../client/src/pages/Utenti/index.tsx'), 'utf8'
  );
  const search = fs.readFileSync(
    path.resolve(__dirname, '../routes/users/search.js'), 'utf8'
  );
  assert.doesNotMatch(source, /deleteMutation|usePendingUserActions|setUserToDelete|EditUserDialog|EditOpinioniDialog|EditUserAvatarDialog/);
  assert.doesNotMatch(source, /Utenti in Attesa|in attesa di approvazione|pendingUsers|PendingUsersTable/i);
  assert.doesNotMatch(search, /router\.get\('\/pending'/);
  assert.doesNotMatch(search, /\bconsole\.(?:log|debug|info|warn|error)\s*\(/,
    'admin user API must not log user identifiers, email, request body or raw errors');
  assert.doesNotMatch(search, /error:\s*error\.message|details:\s*process\.env\.NODE_ENV/);
  assert.match(source, /Le modifiche ai dati non sono disponibili in questa pagina/);
  assert.match(search, /sesso: \['M', 'F'\]\.includes\(user\.sesso\)/);
});

test('profile and OAuth routes never log account identifiers, political answers or raw errors', () => {
  const profile = fs.readFileSync(
    path.resolve(__dirname, '../routes/users/profile.js'), 'utf8'
  );
  const oauth = fs.readFileSync(
    path.resolve(__dirname, '../routes/auth/oauth.js'), 'utf8'
  );
  for (const source of [profile, oauth]) {
    assert.doesNotMatch(source, /\\bconsole\\.(?:log|debug|info|warn|error)\\s*\\(/);
  }
  assert.doesNotMatch(profile, /details:\\s*process\\.env\\.NODE_ENV\\s*\\?\\s*error\\.message/);
  assert.doesNotMatch(oauth, /error:\\s*err\\.message/);
  assert.match(profile, /router\\.put\\('\\/:userId\\/opinioni'/);
  assert.match(oauth, /generateOAuthPendingToken/);
});
