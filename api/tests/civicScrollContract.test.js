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

  assert.match(layout, /location === '\\/avvistamenti' \\|\\| location === '\\/vota-iniziativa-popolare'/);
  assert.match(layout, /isScrollableContentPage \\? ' app-main--scroll-content'/);
  assert.match(css, /\\.app-main\\.app-main--scroll-content\\s*\\{\\s*overflow-y:\\s*hidden\\s*!important/);
  assert.match(css, /\\.app-main\\.app-main--scroll-content \\.fade-up-transition\\s*\\{[^}]*height:\\s*100%;[^}]*min-height:\\s*0;[^}]*overflow:\\s*hidden/);
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
