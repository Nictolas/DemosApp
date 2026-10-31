'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('only the intended civic routes use the bounded scroll shell', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const css = read('client/src/robust-layout.css');

  assert.ok(layout.includes("location === '/avvistamenti' || location === '/vota-iniziativa-popolare' || location === '/grazia' || location === '/capo-stato' || location === '/capo-di-stato'"));
  assert.ok(layout.includes("${isScrollableContentPage ? ' app-main--scroll-content' : ''}"));
  assert.ok(css.includes('.app-main.app-main--scroll-content {\n  overflow-y: hidden !important;'));
  assert.ok(css.includes('.app-main.app-main--scroll-content .fade-up-transition {'));
  assert.ok(css.includes('  height: 100%;\n  min-height: 0;\n  overflow: hidden;'));
});

test('popular initiative voting can scroll all cards above the app navbar', () => {
  const page = read('client/src/pages/VotaIniziativaPopolare/index.tsx');
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(page, /aria-label="Iniziative popolari"/);
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('<IniziativeStatsChart'));
  assert.ok(page.indexOf('<IniziativeRanking') < page.indexOf('{/* Dialog di visualizzazione iniziativa */}'));
  assert.doesNotMatch(page, /min-h-screen bg-gradient-to-b from-background/);
});

test('Grazia keeps title and voting controls fixed; only ranking scrolls', () => {
  const page = read('client/src/pages/Grazia/index.tsx');
  const header = read('client/src/pages/Grazia/components/Header.tsx');
  const app = read('client/src/App.tsx');
  assert.ok(app.includes('<Route path="/grazia">'));
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /grazia-page__fixed-header shrink-0/);
  assert.match(page, /grazia-page__fixed-controls min-h-0 shrink-0/);
  assert.match(page, /className="app-page-scroll min-h-0 min-w-0 overflow-y-auto/);
  assert.match(page, /aria-label="Classifica Grazia"/);
  assert.ok(page.indexOf('grazia-page__fixed-header') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('grazia-page__fixed-controls') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('<GraziaForm') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('<ClassificaCarcerati'));
  assert.ok(page.indexOf('<ClassificaCarcerati') < page.indexOf('{/* Dialog separato dalla classifica scorrevole. */}'));
  assert.ok(!header.includes('<Link'), 'Header must not contain navigation links');
  assert.ok(!header.includes('href="/vota"'), 'No back-to-Vota route');
  assert.ok(!header.includes('Torna a Vota'), 'No back-to-Vota button');
  assert.ok(!header.includes('<ArrowLeft'), 'No back arrow');
  assert.doesNotMatch(page, /page-with-navbar/);
});

test('Capo di Stato keeps title/consent/voting controls fixed while only ranking rows scroll', () => {
  const app = read('client/src/App.tsx');
  const page = read('client/src/pages/CapodiStato/index.tsx');
  const header = read('client/src/pages/CapodiStato/components/Header.tsx');
  const ranking = read('client/src/pages/CapodiStato/components/CandidatesRanking.tsx');

  assert.ok(app.includes('<Route path="/capo-stato">'));
  assert.ok(app.includes('<Route path="/capo-di-stato">'));
  assert.match(page, /<PageContainer className="capo-di-stato-page overflow-hidden/);
  assert.match(page, /capo-stato__fixed-header shrink-0/);
  assert.match(page, /capo-stato__fixed-controls min-h-0/);
  assert.ok(page.indexOf('capo-stato__fixed-header') < page.indexOf('capo-stato__fixed-controls'));
  assert.ok(page.indexOf('capo-stato__fixed-controls') < page.indexOf('<CandidatesRanking'));
  assert.match(ranking, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(ranking, /aria-label="Lista candidati Capo di Stato"/);
  assert.ok(ranking.indexOf('<CardHeader') < ranking.indexOf('app-page-scroll min-h-0'));
  assert.doesNotMatch(header, /<Link|href="\\/vota"|Torna a Vota|<ArrowLeft|\\bVota\\s*<\\/Button>/);
  assert.doesNotMatch(page, /min-h-screen bg-gradient|page-with-navbar/);
});

test('sightings header stays visible while all three categories scroll', () => {
  const page = read('client/src/pages/Avvistamenti/index.tsx');
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /container mx-auto h-full min-h-0 w-full flex flex-col/);
  assert.match(page, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(page, /aria-label="Categorie degli avvistamenti"/);
  assert.ok(page.indexOf('{/* Header */}') < page.indexOf('app-page-scroll min-h-0'));
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('emergencySections.map'));
  for (const section of ['emergenze', 'decoro-urbano', 'sicurezza']) {
    assert.ok(page.includes(`id: "${section}"`));
  }
});
