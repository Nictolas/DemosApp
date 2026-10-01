const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, ...parts), 'utf8');

const governoSource = read('..', 'routes', 'governo.js');
const userSearchSource = read('..', 'routes', 'users', 'search.js');
const governoUiSource = read('..', '..', 'client', 'src', 'pages', 'Governo', 'components', 'GovernoAttualeSection.tsx');
const consiglieriUiSource = read('..', '..', 'client', 'src', 'components', 'ConsiglieriComunaliAutocomplete.tsx');

test('government mutations require authenticated admin access', () => {
  assert.match(governoSource, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/middleware\/auth'\);/);
  assert.match(governoSource, /router\.post\('\/'\, verifyToken, requireAdmin, async/);
  assert.match(governoSource, /router\.put\('\/attuale\/:ruolo'\, verifyToken, requireAdmin, async/);
});

test('direct municipal-councillor discovery is admin-only', () => {
  assert.match(
    userSearchSource,
    /router\.get\('\/consiglieri-comunali'\, verifyToken, requireAdmin, async/
  );
});

test('government edit controls do not treat activists as admins', () => {
  assert.match(governoUiSource, /const isAdmin = user\?\.ruolo === "AD";/);
  assert.doesNotMatch(governoUiSource, /user\?\.ruolo === "A"/);
});

test('municipal-councillor autocomplete does not query for non-admin users', () => {
  assert.match(consiglieriUiSource, /const isAdmin = user\?\.ruolo === "AD";/);
  assert.match(consiglieriUiSource, /if \(!user\?\.id \|\| !isAdmin\) return \{ consiglieri: \[\] \};/);
  assert.match(consiglieriUiSource, /enabled: !!user\?\.id && isAdmin/);
});
