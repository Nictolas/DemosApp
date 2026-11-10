'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Gestione DEMOS shows exactly DPO and three Admin hubs in a bounded two-by-two landing', () => {
  const hubs = read('client/src/pages/Gestisci/constants/hubs.ts');
  const grid = read('client/src/pages/Gestisci/components/SectionsGrid.tsx');
  const page = read('client/src/pages/Gestisci/index.tsx');
  const css = read('client/src/robust-layout.css');
  const threeHubs = ['utenti-verifiche', 'dati-istituzionali', 'ops-center'];
  for (const hub of threeHubs) assert.match(hubs, new RegExp('id: "' + hub + '"'));
  assert.doesNotMatch(hubs, /id: "comunicazioni"/);
  assert.match(grid, /data-testid="gestisci-dpo"/);
  assert.match(grid, /gestisciHubs\.map/);
  assert.match(grid, /gestisci-overview-grid/);
  assert.match(page, /gestisci-page__content/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /aspect-ratio: 1 \/ 1/);
  assert.match(css, /\.menu-page\.gestisci-page:has\(\.gestisci-overview-layout\)\s*\{[^}]*overflow-y: hidden !important/);
  assert.match(grid, /if \(dpoReadOnly\)/);
  assert.match(grid, /\/dpo\?section=/);
});

test('Notifications remain available beneath Users and Proposals with existing Admin permissions', () => {
  const hubs = read('client/src/pages/Gestisci/constants/hubs.ts');
  const sections = read('client/src/pages/Gestisci/constants/sections.ts');
  const page = read('client/src/pages/NotificheTotali/index.tsx');
  assert.match(hubs, /"utenti", "riconoscimenti", "proposte-soggetti", "opinioni", "notifiche-totali"/);
  assert.match(sections, /id: "notifiche-totali"/);
  assert.match(sections, /route: "\/notifiche-totali"/);
  assert.match(page, /hasAdminCapability\(user\)/);
  for (const tab of ['invio', 'cronologia', 'diagnostica']) assert.ok(page.includes('value="' + tab + '"'));
});

test('Sistema e sicurezza owns mobile touch scroll without scrolling the navbar', () => {
  const ops = read('client/src/pages/Admin/OpsCenter.tsx');
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const css = read('client/src/robust-layout.css');
  assert.match(layout, /location === '\/admin\/ops-center' \? ' app-main--admin-ops'/);
  assert.match(ops, /admin-ops-page/);
  assert.match(css, /\.app-main\.app-main--admin-ops\s*\{[^}]*overflow-y: hidden !important/);
  assert.match(css, /\.app-main\.app-main--admin-ops \.fade-up-transition\s*\{[^}]*height: 100%;[^}]*min-height: 0;[^}]*overflow: hidden/);
  assert.match(css, /\.app-main\.app-main--admin-ops \.admin-ops-page\s*\{[^}]*overflow-y: auto !important;[^}]*-webkit-overflow-scrolling: touch/);
  assert.match(layout, /<nav className="app-navbar navbar-visible"/);
  assert.equal((ops.match(/<details /g) || []).length, 4);
});
