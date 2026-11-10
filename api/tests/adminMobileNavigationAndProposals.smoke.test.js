'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Admin section cards navigate via click, preserving native touch scroll', () => {
  const card = read('client/src/pages/Gestisci/components/SectionCard.tsx');
  assert.match(card, /onClick=\{\(\) => window\.location\.assign\(section\.route\)\}/);
  assert.doesNotMatch(card, /onTouchStart|onTouchEnd|onMouseUp|preventDefault/);
});

test('Gestisci has an iOS scrollport inside the fixed application shell', () => {
  const page = read('client/src/pages/Gestisci/index.tsx');
  const css = read('client/src/robust-layout.css');
  assert.match(page, /menu-page gestisci-page/);
  assert.match(css, /\.app-main \.menu-page\.gestisci-page\s*\{/);
  assert.match(css, /overflow-y: auto !important/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
});

test('DPO uses Admin or DPO capability and makes selected metrics visible after tap', () => {
  const panel = read('client/src/pages/DpoPanel.tsx');
  assert.match(panel, /hasAdminCapability\(user\) \|\| hasDpoCapability\(user\)/);
  assert.match(panel, /navigate\(area \? "\/dpo\?section="/);
  assert.doesNotMatch(panel, /scrollIntoView/);
  assert.match(panel, /dpo-panel-page--overview/);
  assert.match(panel, /dpo-panel-page--detail/);
  assert.match(panel, /id="dpo-area-detail"/);
  assert.match(panel, /if \(!canViewDpo\) return <Redirect to="\/preferiti" \/>/);
  assert.doesNotMatch(panel, /\/admin\/data-export|\/backup-dashboard/);
});

test('Opinion proposal ranking is separate from catalog edits', () => {
  const sections = read('client/src/pages/Gestisci/constants/sections.ts');
  const hubs = read('client/src/pages/Gestisci/constants/hubs.ts');
  const proposed = read('client/src/pages/GestisciOpinioni/components/OpinioniProposte.tsx');
  const catalog = read('client/src/pages/GestisciOpinioni/components/ListaOpinioni.tsx');
  assert.match(sections, /title: "Proposte di opinioni"/);
  assert.doesNotMatch(sections, /Aggiungi o elimina le opinioni disponibili/);
  assert.doesNotMatch(hubs, /sectionIds: \["opinioni", "governo"\]/);
  assert.match(hubs, /sectionIds: \["utenti", "riconoscimenti", "proposte-soggetti", "opinioni", "notifiche-totali"\]/);
  assert.doesNotMatch(hubs, /id: "contenuti"/);
  assert.match(proposed, /Number\(b\.voti\)/);
  assert.match(proposed, /classifica/i);
  assert.match(catalog, /sola lettura/);
});

test('Public opinion proposal list does not query or return proposer identities', () => {
  const route = read('api/routes/opinioni-proposte.js');
  const getStart = route.indexOf("router.get('/', async (req, res) => {");
  const postStart = route.indexOf("router.post('/', verifyToken", getStart);
  assert.ok(getStart >= 0 && postStart > getStart);
  const publicList = route.slice(getStart, postStart);
  assert.doesNotMatch(publicList, /SELECT opinione_proposta_id, nome, cognome, email FROM users/);
  assert.doesNotMatch(publicList, /proponente:\s*proposersByOpinionId/);
  assert.match(publicList, /COUNT\(\*\) as voti_count/);
});

test('DPO overview fits six areas into a non-scrollable mobile grid', () => {
  const panel = read('client/src/pages/DpoPanel.tsx');
  const css = read('client/src/robust-layout.css');
  const areaIds = ['utenti-verifiche', 'contenuti', 'comunicazioni', 'dati-istituzionali', 'ops-center', 'gdpr'];
  for (const id of areaIds) assert.match(panel, new RegExp('id: "' + id + '"'));
  assert.match(css, /\.app-main \.dpo-panel-page--overview\s*\{/);
  assert.match(css, /overflow-y: hidden !important/);
  assert.match(css, /grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(panel, /showOverview \? \(/);
  assert.match(panel, /selectedArea === null/);
  assert.match(panel, /Torna alle aree/);
  assert.match(panel, /window\.addEventListener\("popstate", restoreView\)/);
});
