'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const sourceRoot = path.join(root, 'client', 'src');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function walk(folder) {
  const results = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const location = path.join(folder, entry.name);
    if (entry.isDirectory()) results.push(...walk(location));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) results.push(location);
  }
  return results;
}

test('the exact /menu route redirects to Preferiti without rendering Menu', () => {
  const app = read('client/src/App.tsx');
  assert.match(app, /<Route path="\/menu">\s*<Redirect to="\/preferiti"\s*\/>\s*<\/Route>/);
  assert.doesNotMatch(app, /ProtectedRoute path="\/menu"/);
  // Legacy profile paths remain usable; the retired page is only exact /menu.
  assert.match(app, /<Route path="\/menu\/profilo">/);
  assert.match(app, /<Route path="\/menu\/profilo\/:userId">/);
});

test('the empty candidate or representative page returns to Preferiti', () => {
  const empty = read('client/src/pages/ScegliRappresentante/components/EmptyState.tsx');
  assert.match(empty, /<Link href="\/preferiti">Torna ai Preferiti<\/Link>/);
  assert.doesNotMatch(empty, /Link to="\/menu"/);
});

test('navigation maps return to Preferiti, never to the retired Menu', () => {
  const app = read('client/src/App.tsx');
  const navigation = read('client/src/hooks/useBrowserNavigation.ts');
  for (const src of [app, navigation]) {
    assert.match(src, /'\/menu': '\/preferiti'/);
    assert.doesNotMatch(src, /:\s*['"]\/menu['"]/);
  }
  assert.match(navigation, /setLocation\('\/preferiti'\)/);
});

test('no live or dormant client navigation target points to exactly /menu', () => {
  const permitted = new Set(['App.tsx', 'hooks/useBrowserNavigation.ts']);
  for (const filename of walk(sourceRoot)) {
    const relative = path.relative(sourceRoot, filename).replace(/\\/g, '/');
    const code = fs.readFileSync(filename, 'utf8');
    const literalMatches = [...code.matchAll(/(['"])\/menu\1/g)];
    if (permitted.has(relative)) {
      const expected = relative === 'App.tsx' ? 2 : 1;
      assert.equal(literalMatches.length, expected, `${relative}: only route and legacy map key may reference /menu`);
    } else {
      assert.equal(literalMatches.length, 0, `${relative}: old Menu navigation target`);
    }
  }
});
