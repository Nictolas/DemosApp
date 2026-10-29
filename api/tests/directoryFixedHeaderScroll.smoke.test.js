'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Attivisti and Organizzazioni shell has no document-level scroll', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const css = read('client/src/robust-layout.css');
  assert.match(layout, /location === '\/attivisti' \|\| location === '\/organizzazioni' \? ' app-main--directory'/);
  assert.match(css, /\.app-main\.app-main--directory\s*\{\s*overflow-y:\s*hidden\s*!important/);
  assert.match(css, /\.app-main\.app-main--directory > \.app-main__inner\s*\{\s*overflow:\s*hidden/);
  assert.match(css, /\.app-main\.app-main--directory \.fade-up-transition\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/);
  // Existing page shells remain untouched.
  assert.match(css, /\.app-main\.app-main--notifiche/);
  assert.match(css, /\.app-main\.app-main--eventi/);
});

for (const [name, file] of [
  ['Attivisti', 'client/src/pages/Attivisti.tsx'],
  ['Organizzazioni', 'client/src/pages/Organizzazioni/index.tsx']
]) {
  test(name + ' keeps title, search and filters fixed and only scrolls cards/results', () => {
    const page = read(file);
    const header = page.indexOf('{/* Header */}');
    const search = page.indexOf('{/* Barra di Ricerca e Filtri */}');
    const filters = page.indexOf('{/* Pannello Filtri Avanzati */}');
    const scroll = page.indexOf('className="app-page-scroll min-h-0 flex-1 overflow-y-auto');
    const loading = page.indexOf('{/* Loading State */}');
    const results = page.indexOf('{/* ' + name + ' List */}');
    const dialog = page.indexOf('{/* Modale ');
    assert.ok(header >= 0 && search > header && filters > search);
    assert.ok(scroll > filters && loading > scroll && results > scroll);
    assert.ok(dialog > results, 'Modal should remain outside the scrolling container');
    assert.match(page, /<PageContainer className="directory-(?:attivisti|organizzazioni)-page overflow-hidden bg-gray-50">/);
    assert.match(page, /role="region"/);
    assert.match(page, new RegExp('aria-label="Elenco ' + name.toLowerCase() + '"'));
    assert.match(page, /tabIndex=\{0\}/);
    assert.match(page, /max-h-\[25dvh\] overflow-y-auto overscroll-contain/);
    assert.doesNotMatch(page, /min-h-screen bg-gray-50/);
    assert.match(page, /overscroll-contain px-4 pb-4 pt-4/);
  });
}

test('Directory list changes do not introduce new Supabase requests or change voting', () => {
  for (const file of ['client/src/pages/Attivisti.tsx', 'client/src/pages/Organizzazioni/index.tsx']) {
    const page = read(file);
    assert.match(page, /\/api\/sostenitori\/following/);
    assert.match(page, /\/api\/sostenitori\/follow/);
    assert.match(page, /\/api\/sostenitori\/unfollow/);
    assert.doesNotMatch(page, /from\(['"]supabase/);
  }
});
