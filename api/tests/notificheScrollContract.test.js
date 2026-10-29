'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('only the notifications route disables the app-shell scroll', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const css = read('client/src/robust-layout.css');

  assert.match(layout, /location === '\/notifiche' \? ' app-main--notifiche'/);
  assert.match(css, /\.app-main\.app-main--notifiche\s*\{\s*overflow-y:\s*hidden\s*!important/);
  assert.match(css, /\.app-main\.app-main--notifiche \.fade-up-transition\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/);
});

test('notifications header and counter are outside the one scrollable list', () => {
  const page = read('client/src/pages/Notifiche/index.tsx');
  const header = read('client/src/pages/Notifiche/components/Header.tsx');
  const list = read('client/src/pages/Notifiche/components/ListaNotifiche.tsx');

  assert.match(page, /<PageContainer className="notifiche-page overflow-hidden/);
  assert.match(page, /<Header total=\{data\?\.notifiche\?\.length \?\? 0\} isLoading=\{isLoading\} \/>/);
  assert.ok(page.indexOf('<Header total=') < page.indexOf('app-page-scroll min-h-0 flex-1 overflow-y-auto'));
  assert.ok(page.indexOf('app-page-scroll min-h-0 flex-1 overflow-y-auto') < page.indexOf('<ListaNotifiche'));
  assert.match(page, /aria-label="Elenco notifiche"/);
  assert.match(header, /setLocation\("\/notifiche\/preferenze"\)/);
  assert.doesNotMatch(list, /<Card\b/);
});

test('notification actions remain in their existing item component', () => {
  const item = read('client/src/pages/Notifiche/components/NotificaItem.tsx');
  assert.match(item, /handleReaction\('like'\)/);
  assert.match(item, /handleReaction\('dislike'\)/);
  assert.match(item, /handleDeleteSegnalazione/);
  assert.match(item, /style\.cardAccent/);
});
