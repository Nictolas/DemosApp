'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Admin notification management has its own route-scoped scrollport', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const page = read('client/src/pages/NotificheTotali/index.tsx');
  const css = read('client/src/robust-layout.css');

  assert.match(layout, /location === '\/notifiche-totali' \? ' app-main--admin-notifiche'/);
  assert.match(page, /<PageContainer className="admin-notifiche-page /);
  assert.match(css, /\.app-main\.app-main--admin-notifiche\s*\{[^}]*overflow-y: hidden !important/);
  assert.match(css, /\.app-main\.app-main--admin-notifiche \.fade-up-transition\s*\{[^}]*height: 100%;[^}]*min-height: 0;[^}]*overflow: hidden/);
  assert.match(css, /\.app-main\.app-main--admin-notifiche \.admin-notifiche-page\s*\{[^}]*overflow-y: auto !important;[^}]*overflow-x: hidden !important;[^}]*-webkit-overflow-scrolling: touch/);
});

test('Admin and citizen notification scroll behaviors do not interfere', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  const css = read('client/src/robust-layout.css');
  const page = read('client/src/pages/NotificheTotali/index.tsx');

  assert.match(layout, /location === '\/notifiche' \? ' app-main--notifiche'/);
  assert.match(css, /\.app-main\.app-main--notifiche\s*\{[^}]*overflow-y: hidden !important/);
  assert.match(page, /<TabsTrigger value="invio">/);
  assert.match(page, /<TabsTrigger value="cronologia">/);
  assert.match(page, /<TabsTrigger value="diagnostica">/);
  assert.match(page, /<NotificheTable/);
});
