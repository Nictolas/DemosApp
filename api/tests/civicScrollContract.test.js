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

  assert.ok(layout.includes("location === '/avvistamenti' || location === '/vota-iniziativa-popolare' || location === '/grazia'"));
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

test('Grazia scrolls complete voting form and ranking inside the navbar boundary', () => {
  const page = read('client/src/pages/Grazia/index.tsx');
  const app = read('client/src/App.tsx');
  assert.ok(app.includes('<Route path="/grazia">'));
  assert.match(page, /<PageContainer className="overflow-hidden/);
  assert.match(page, /className="app-page-scroll min-h-0 flex-1 overflow-y-auto/);
  assert.match(page, /aria-label="Contenuti della pagina Grazia"/);
  assert.ok(page.indexOf('app-page-scroll min-h-0') < page.indexOf('<GraziaForm'));
  assert.ok(page.indexOf('<GraziaForm') < page.indexOf('<ClassificaCarcerati'));
  assert.ok(page.indexOf('<ClassificaCarcerati') < page.indexOf('{/* Dialog di conferma rimozione voto */}'));
  assert.doesNotMatch(page, /page-with-navbar/);
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
