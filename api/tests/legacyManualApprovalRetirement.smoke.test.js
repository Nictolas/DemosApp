'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Admin /utenti has no manual approval interface or extra pending polling', () => {
  const page = read('client/src/pages/Utenti/index.tsx');
  const hook = read('client/src/pages/Utenti/hooks/useUsers.ts');
  const types = read('client/src/pages/Utenti/types/index.ts');
  assert.doesNotMatch(page, /pendingUsers|PendingUsersTable|MobilePendingUsersTable|handleApproveUser|handleRejectUser|usePendingUserActions|Utenti in Attesa|In Attesa/);
  assert.doesNotMatch(hook, /pendingUsers|\/api\/users\/pending|Promise\.all/);
  assert.match(hook, /apiRequest\("GET", "\/api\/users"\)/);
  assert.doesNotMatch(types, /pendingUsers/);
  for (const relative of [
    'client/src/pages/Utenti/components/PendingUsersTable.tsx',
    'client/src/pages/Utenti/components/MobilePendingUsersTable.tsx',
    'client/src/pages/Utenti/hooks/usePendingUserActions.ts'
  ]) assert.equal(fs.existsSync(path.join(root, relative)), false, relative);
});

test('Admin pending-account endpoints are retired, canonical DELETE remains guarded', () => {
  const admin=read('api/routes/users/admin.js');
  const search=read('api/routes/users/search.js');
  const self=read('api/routes/user/delete-account.js');
  const protectedRoute=read('client/src/lib/protected-route.tsx');
  assert.doesNotMatch(admin, /router\.post\('\/(?:approve|reject)'/);
  assert.doesNotMatch(search, /router\.get\('\/pending'/);
  assert.match(admin, /router\.delete\('\/:userId', verifyToken, requireAdmin/);
  assert.match(admin, /PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/);
  assert.match(self, /PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/);
  assert.doesNotMatch(protectedRoute, /\/verifica-email|user\.status === 'pending'/);
});

test('new Google/Apple OAuth and WebAuthn passkey accounts are active immediately on completion', () => {
  const oauth=read('api/services/oauthRegistrationService.js');
  const passkey=read('api/services/passkeyRegistrationService.js');
  const oauthRoute=read('api/routes/auth/oauth.js');
  const recognition=read('api/routes/riconoscimenti.js');
  assert.match(oauth, /INSERT INTO users \(/);
  assert.match(oauth, /\$1, \$2, 'a',/);
  assert.match(passkey, /INSERT INTO users \(/);
  assert.match(passkey, /\$1, 'E', \$2, \$3, \$4, \$5, \$6, 'a',/);
  // A short-lived OAuth *registration* ticket is not a manual-approval user row.
  assert.match(oauthRoute, /generateOAuthPendingToken/);
  // The separate political recognition workflow remains in place.
  assert.match(recognition, /riconoscimenti/);
});
