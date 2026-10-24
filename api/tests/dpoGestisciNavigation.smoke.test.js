'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('authenticated /auth/me profile exposes DB-backed DPO flag, not token role', () => {
  const server = read('api/routes/auth/profile.js');
  const auth = read('client/src/hooks/use-auth.tsx');
  assert.match(server, /u\.status, u\.is_dpo, u\.created_at/);
  assert.match(server, /is_dpo: user\.status === 'a' && user\.is_dpo === true/);
  assert.match(auth, /is_dpo\?: boolean/);
  const jwtFallback = auth.slice(auth.indexOf('if (!user && token)'), auth.indexOf('const logoutMutation'));
  assert.doesNotMatch(jwtFallback, /is_dpo\s*:/);
});

test('DPO is a separate capability, never a synonym for Admin', () => {
  const access = read('client/src/lib/admin-access.ts');
  assert.match(access, /account\.is_dpo === true/);
  assert.match(access, /account\.is_admin !== true/);
  assert.match(access, /account\.status === "a"/);
  assert.match(access, /normalizePath\(path\) === "\/gestisci"/);
  assert.match(access, /normalized\.startsWith\("\/gestisci-"\)/);
  const wrapper = read('client/src/components/AppWrapper.tsx');
  assert.match(wrapper, /isAdminOnlyPath\(location\)/);
  assert.match(wrapper, /!hasAdminCapability\(user\) && !\(isGestisciHomePath\(location\) && hasDpoCapability\(user\)\)/);
});

test('Gestisci exposes DPO overview cards without granting underlying Admin routes', () => {
  const home = read('client/src/pages/Gestisci/index.tsx');
  const hubs = read('client/src/pages/Gestisci/components/SectionsGrid.tsx');
  const panel = read('client/src/pages/DpoPanel.tsx');
  assert.match(home, /const isAdmin = hasAdminCapability\(user\)/);
  assert.match(home, /const isDpo = hasDpoCapability\(user\)/);
  assert.match(home, /if \(!isAdmin && !isDpo\)/);
  assert.match(home, /data-testid="gestisci-dpo"/);
  assert.match(home, /<SectionsGrid dpoReadOnly=\{!isAdmin && isDpo\} \/>/);
  assert.match(hubs, /if \(dpoReadOnly\)/);
  assert.match(hubs, /\/dpo\?section=/);
  assert.match(hubs, /Riepilogo aggregato in sola lettura/);
  assert.match(panel, /\/dpo\/areas/);
  assert.match(panel, /aggregated_readonly/);
  assert.doesNotMatch(panel, /\/admin\/data-export|\/backup-dashboard/);
});

test('main logos link Admin and DPO capabilities to Gestisci without legacy-role assumptions', () => {
  const menu = read('client/src/pages/Menu/index.tsx');
  const menuHeader = read('client/src/pages/Menu/components/MenuHeader.tsx');
  const preferiti = read('client/src/pages/Preferiti/index.tsx');
  const desktop = read('client/src/components/DesktopAppHeader.tsx');
  assert.match(menu, /isAdmin \|\| hasDpoCapability\(user\)/);
  assert.match(menuHeader, /aria-label="Apri la sezione Gestisci"/);
  assert.doesNotMatch(menuHeader, /<img[^>]*onClick=/s);
  assert.match(preferiti, /hasAdminCapability\(user\) \|\| hasDpoCapability\(user\)/);
  assert.match(desktop, /hasAdminCapability\(user\) \|\| hasDpoCapability\(user\)/);
  assert.match(desktop, /if \(canOpenGestisci\) setLocation\("\/gestisci"\)/);
});
