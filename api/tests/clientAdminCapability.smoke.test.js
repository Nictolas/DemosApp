const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('client Admin helper grants access only from is_admin capability', () => {
  const src = read('client/src/lib/admin-access.ts');
  assert.match(src, /is_admin/);
  assert.match(src, /=== true/);
  assert.doesNotMatch(src, /ruolo\s*===\s*['"]AD['"]/);
});

test('/gestisci redirects authenticated non-Admin users away', () => {
  const src = read('client/src/pages/Gestisci/index.tsx');
  assert.match(src, /hasAdminCapability\(user\)/);
  assert.match(src, /<Redirect to="\/menu" \/>/);
});

test('menu logo Admin access uses canonical capability helper', () => {
  const src = read('client/src/pages/Menu/hooks/useMenuData.ts');
  assert.match(src, /hasAdminCapability\(user\)/);
  assert.doesNotMatch(src, /const isAdmin = user\?\.ruolo === ['"]AD['"]/);
});
