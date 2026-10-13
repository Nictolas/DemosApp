const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('voluntary account deletion uses the qualified schema-aware service', () => {
  const src = read(path.join('routes', 'user', 'delete-account.js'));
  assert.match(src, /PrivacyErasureLedgerService\.recordEvent/);
  assert.match(src, /PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/);
  assert.doesNotMatch(src, /DELETE FROM voti_[a-z0-9_]+ WHERE user_id = \$1/i);
});

test('Admin reject and delete both use canonical account erasure', () => {
  const src = read(path.join('routes', 'users', 'admin.js'));
  assert.match(src, /source: 'admin_reject_pending'/);
  assert.match(src, /source: 'admin_account_deletion'/);
  const calls = src.match(/PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/g) || [];
  assert.equal(calls.length, 2);
  assert.doesNotMatch(src, /DELETE FROM users WHERE id = \$1/);
  assert.match(src, /String\(userId\) === String\(req\.userId\)/);
});

test('Camera politician deletion cannot bypass account privacy cleanup', () => {
  const src = read(path.join('routes', 'voti-camera.js'));
  assert.match(src, /source: 'admin_voti_camera_politician_deletion'/);
  assert.match(src, /PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/);
  assert.doesNotMatch(src, /DELETE FROM users WHERE id = \$1/);
});

test('schema-aware erasure covers communication rows and historical user-id variants', () => {
  const src = read(path.join('services', 'privacyErasureLedgerService.js'));
  assert.match(src, /accountLinkColumns = \['user_id', 'userid', 'userId', 'utente_id', 'id_utente'\]/);
  assert.match(src, /deleteByColumn\(client, 'comunicazioni', 'id_utente', userId\)/);
  assert.match(src, /identity_verifications/);
});
