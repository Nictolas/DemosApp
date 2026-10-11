'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const appSource = fs.readFileSync(path.join(ROOT, 'client', 'src', 'App.tsx'), 'utf8');
const catalog = fs.readFileSync(path.join(ROOT, 'docs', 'PRODUCT_FEATURE_CATALOG.md'), 'utf8');

function collectAppRoutes(source) {
  const paths = [];
  const regex = /<Route\s+path="([^"]+)"/g;
  let match;
  while ((match = regex.exec(source)) !== null) paths.push(match[1]);
  return [...new Set(paths)];
}

test('catalog covers every route registered in App.tsx', () => {
  const routes = collectAppRoutes(appSource);
  assert.ok(routes.length >= 100, `expected a substantial route inventory, found ${routes.length}`);
  const missing = routes.filter((route) => !catalog.includes(`\`${route}\``));
  assert.deepEqual(missing, [], `uncatalogued routes: ${missing.join(', ')}`);
});

test('catalog separates active, limited, admin and retired states', () => {
  for (const state of [
    'ATTIVA',
    'ATTIVA / ACCESSO LIMITATO',
    'PUBBLICA',
    'INTERNA / ADMIN',
    'ALIAS / COMPATIBILITÀ',
    'RITIRATA / REDIRECT',
  ]) {
    assert.match(catalog, new RegExp(state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('catalog records the canonical retirement of old referendum, ICE and manual-proposal actions', () => {
  const retired = [
    '/vota-referendum-abrogativo',
    '/vota-ice',
    '/proponi-referendum-abrogativi',
    '/proponi-iniziativa-popolare',
    '/proponi-ice',
  ];
  for (const route of retired) {
    const row = catalog.split('\n').find((line) => line.includes(`\`${route}\``) && line.includes('|'));
    assert.ok(row, `missing catalog row for ${route}`);
    assert.match(row, /RITIRATA \/ REDIRECT/);
  }
});

test('catalog documents canonical account capabilities instead of only legacy roles', () => {
  assert.match(catalog, /isAdmin/);
  assert.match(catalog, /isActivist/);
  assert.match(catalog, /isCandidate/);
  assert.match(catalog, /isPolitician/);
  assert.match(catalog, /PERSON/);
  assert.match(catalog, /INSTITUTION/);
  assert.match(catalog, /ORGANIZATION/);
});

test('catalog includes all main user navigation areas', () => {
  for (const route of ['/profilo', '/opinioni', '/vota', '/preferiti', '/eventi', '/firma', '/notifiche', '/strumenti', '/avvistamenti', '/impostazioni']) {
    assert.match(catalog, new RegExp(`\\\`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\``));
  }
});
