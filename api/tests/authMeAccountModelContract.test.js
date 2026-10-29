'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = fs.readFileSync(path.join(__dirname, '../routes/auth/profile.js'), 'utf8');

test('/auth/me projects role and flags from canonical getAccountSubject', () => {
  assert.match(file, /const accountSubject = await getAccountSubject\(pool, user\.id\)/);
  assert.match(file, /ruolo: accountSubject\.legacyRole/);
  assert.match(file, /is_admin: accountCapabilities\.isAdmin/);
  assert.match(file, /is_candidate: accountCapabilities\.isCandidate/);
  assert.match(file, /is_politician: accountCapabilities\.isPolitician/);
  assert.match(file, /account_type: accountCapabilities\.accountType/);
  assert.doesNotMatch(file, /\b(?:u|user)\.ruolo\b/);
});

test('/auth/me preserves DPO separation and account status', () => {
  assert.match(file, /user\.status === 'a'/);
  assert.match(file, /user\.is_dpo === true && !accountCapabilities\.isAdmin/);
  assert.match(file, /status: user\.status/);
  assert.match(file, /if \(!accountSubject\)/);
  assert.match(file, /SELECT \* FROM users WHERE id = \$1/);
});
