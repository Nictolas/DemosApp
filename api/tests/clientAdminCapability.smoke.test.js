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

test('Admin route classifier covers operational and management surfaces', () => {
  const src = read('client/src/lib/admin-access.ts');
  for (const route of [
    '/admin',
    '/gestisci',
    '/monitoring-dashboard',
    '/security-dashboard',
    '/backup-dashboard',
    '/rate-limiting-dashboard',
    '/logging-dashboard',
    '/audit-dashboard',
    '/notifiche-totali',
    '/utenti',
    '/test-ministero',
    '/statistiche-utenti',
  ]) {
    assert.match(src, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(src, /startsWith\(\"\/gestisci-\"\)/);
  assert.match(src, /startsWith\(\"\/admin\/\"\)/);
});

test('AppWrapper blocks direct Admin routes before rendering the route tree', () => {
  const src = read('client/src/components/AppWrapper.tsx');
  assert.match(src, /isAdminOnlyPath\(location\)/);
  assert.match(src, /hasAdminCapability\(user\)/);
  assert.match(src, /<Redirect to="\/menu" \/>/);
  assert.match(src, /<Redirect to="\/auth" \/>/);
  assert.doesNotMatch(src, /ruolo\s*===\s*['"]AD['"]/);
});

test('auth user type exposes is_admin without deriving it from the legacy JWT role', () => {
  const src = read('client/src/hooks/use-auth.tsx');
  assert.match(src, /is_admin\?: boolean/);
  const jwtFallback = src.slice(src.indexOf('if (!user && token)'), src.indexOf('const logoutMutation'));
  assert.doesNotMatch(jwtFallback, /is_admin\s*:/);
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
