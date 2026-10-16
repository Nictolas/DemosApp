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

test('/utenti uses canonical Admin capability instead of legacy role strings', () => {
  const src = read('client/src/pages/Utenti/index.tsx');
  assert.match(src, /hasAdminCapability\(user\)/);
  assert.doesNotMatch(src, /user\.role !== ['"]Admin['"]/);
  assert.doesNotMatch(src, /ruolo !== ['"]AD['"]/);
});

test('auth state refreshes on mount and window focus so capability changes are picked up', () => {
  const src = read('client/src/hooks/use-auth.tsx');
  assert.match(src, /refetchOnWindowFocus:\s*true/);
  assert.match(src, /refetchOnMount:\s*["']always["']/);
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

test('/gestisci home exposes five canonical hubs instead of low-level tools', () => {
  const hubs = read('client/src/pages/Gestisci/constants/hubs.ts');
  const grid = read('client/src/pages/Gestisci/components/SectionsGrid.tsx');

  for (const id of [
    'utenti-verifiche',
    'contenuti',
    'comunicazioni',
    'dati-istituzionali',
    'ops-center',
  ]) {
    assert.match(hubs, new RegExp(`id: ["']${id}["']`));
  }

  const hubArray = hubs.slice(hubs.indexOf('export const gestisciHubs'));
  assert.equal((hubArray.match(/\n\s*id: /g) || []).length, 5);
  assert.doesNotMatch(hubs, /sectionIds:\s*\[[^\]]*["']backup-recovery["']/s);
  assert.doesNotMatch(hubs, /sectionIds:\s*\[[^\]]*["']data-export["']/s);
  assert.match(hubs, /route:\s*["']\/admin\/ops-center["']/);
  assert.match(grid, /gestisciHubs\.map/);
  assert.match(grid, /selectedHubId/);
});

test('web API defaults to the restored canonical domain while native fallback remains isolated', () => {
  const apiConfig = read('client/src/lib/api-config.ts');
  const apiRequest = read('client/src/lib/api-request.ts');

  for (const src of [apiConfig, apiRequest]) {
    assert.match(src, /CANONICAL_API_BASE_URL\s*=\s*['"]https:\/\/api\.demos\.community\/api['"]/);
    assert.match(src, /NATIVE_API_FALLBACK_URL\s*=\s*['"]https:\/\/demos-c7k0\.onrender\.com\/api['"]/);
    assert.match(src, /Capacitor\.isNativePlatform\(\)/);
  }
  assert.match(apiConfig, /return configuredBaseUrl \|\| CANONICAL_API_BASE_URL/);
  assert.match(apiRequest, /return configured \|\| CANONICAL_API_BASE_URL/);
});

test('Ops Center identifies Neon and reads the existing Security Center health endpoint', () => {
  const src = read('client/src/pages/Admin/OpsCenter.tsx');
  assert.match(src, /Database \(Neon\)/);
  assert.doesNotMatch(src, /Database \(Supabase\)/);
  assert.match(src, /\/security-center\/health/);
  assert.match(src, /AI Cybersecurity Agent/);
  assert.match(src, /Non disponibile/);
});

test('Data Export uses real API data, authenticated downloads and no web Render fallback', () => {
  const src = read('client/src/pages/DataExport.tsx');
  assert.match(src, /getApiUrl/);
  assert.match(src, /getAuthToken/);
  assert.match(src, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(src, /Neon Database/);
  assert.match(src, /Neon → Axiom/);
  assert.doesNotMatch(src, /mockTables/);
  assert.doesNotMatch(src, /usa dati mock/i);
  assert.doesNotMatch(src, /demos-c7k0\.onrender\.com/);
  assert.doesNotMatch(src, /Supabase/);
});

test('communications hub exposes one canonical notification surface with send, history and diagnostics', () => {
  const hubs = read('client/src/pages/Gestisci/constants/hubs.ts');
  const sections = read('client/src/pages/Gestisci/constants/sections.ts');
  const notifications = read('client/src/pages/NotificheTotali/index.tsx');

  assert.match(hubs, /sectionIds:\s*\[["']notifiche-totali["']\]/);
  assert.doesNotMatch(hubs, /notifiche-demos/);
  assert.match(sections, /id:\s*["']notifiche-totali["']/);
  assert.doesNotMatch(sections, /id:\s*["']notifiche-demos["']/);
  assert.match(sections, /title:\s*["']Notifiche["']/);
  assert.doesNotMatch(sections, /Supabase/);
  assert.match(notifications, /hasAdminCapability\(user\)/);
  assert.match(notifications, /value="invio"/);
  assert.match(notifications, /value="cronologia"/);
  assert.match(notifications, /value="diagnostica"/);
  assert.match(notifications, /\/api\/comunicazioni\/send-user-notification/);
  assert.match(notifications, /\/api\/notifiche-totali/);
  assert.match(notifications, /\/api\/comunicazioni\/debug-firebase-admin/);
});

test('/auth/me identity refresh bypasses HTTP caches so Admin capability cannot fall back to stale JWT role', () => {
  const auth = read('client/src/hooks/use-auth.tsx');
  const profile = read('api/routes/auth/profile.js');
  assert.match(auth, /cache:\s*["']no-store["']/);
  assert.match(profile, /Cache-Control["']?,\s*["']private, no-store, max-age=0["']/);
});
