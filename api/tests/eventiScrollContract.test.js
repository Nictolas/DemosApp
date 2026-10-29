'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Eventi uses same full-height shell and isolated scroll as Notifiche', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const css = read('client/src/robust-layout.css');
  assert.match(layout, /location === '\/eventi' \? ' app-main--eventi'/);
  assert.match(css, /\.app-main\.app-main--eventi\s*\{\s*overflow-y:\s*hidden\s*!important/);
  assert.match(css, /\.app-main\.app-main--eventi > \.app-main__inner\s*\{\s*overflow:\s*hidden/);
  assert.match(css, /\.app-main\.app-main--eventi \.fade-up-transition\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/);
  assert.match(css, /\.app-main\.app-main--notifiche\s*\{\s*overflow-y:\s*hidden\s*!important/);
});

test('Eventi title, territorial tabs and description are outside scrolling cards', () => {
  const page = read('client/src/pages/Eventi.tsx');
  assert.match(page, /<PageContainer className="eventi-page overflow-hidden/);
  assert.doesNotMatch(page, /paddingBottom:\s*'280px'/);
  const title = page.indexOf('<h1 className="text-2xl');
  const tabs = page.indexOf('role="tablist"');
  const description = page.indexOf('aria-live="polite"');
  const scroll = page.indexOf('className="app-page-scroll min-h-0 flex-1 overflow-y-auto');
  const list = page.indexOf('{/* Schede Eventi */}');
  const endScroll = page.indexOf('{/* Modal per modificare evento */}');
  assert.ok(title >= 0 && title < tabs);
  assert.ok(tabs < description && description < scroll);
  assert.ok(scroll < list && list < endScroll);
  assert.match(page, /aria-label="Elenco eventi"/);
  assert.match(page, /tabIndex=\{0\}/);
  assert.match(page, /overscroll-contain/);
  assert.ok(page.indexOf('Dati delle mobilitazioni:') > scroll, 'source attribution should scroll with list');
});

test('Eventi only changes layout, not geographic data or API requests', () => {
  const page = read('client/src/pages/Eventi.tsx');
  assert.match(page, /composeTerritorialEvents\(/);
  assert.match(page, /'personal' \| 'regional' \| 'global'/);
  assert.match(page, /getApiUrl\("\/api\/eventi\/pubblici"\)/);
  assert.match(page, /apiRequest\("GET", "\/api\/eventi\?view=personal"\)/);
  assert.match(page, /<Dialog open=\{isEditModalOpen\}/);
});
