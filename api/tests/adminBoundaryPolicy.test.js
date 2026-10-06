const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, ...parts), 'utf8');

const authSource = read('..', 'middleware', 'auth.js');
const governoSource = read('..', 'routes', 'governo.js');
const userSearchSource = read('..', 'routes', 'users', 'search.js');
const governoUiSource = read('..', '..', 'client', 'src', 'pages', 'Governo', 'components', 'GovernoAttualeSection.tsx');
const consiglieriUiSource = read('..', '..', 'client', 'src', 'components', 'ConsiglieriComunaliAutocomplete.tsx');

test('government mutations require authenticated admin access', () => {
  assert.match(governoSource, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/middleware\/auth'\);/);
  assert.match(governoSource, /router\.post\('\/'\, verifyToken, requireAdmin, async/);
  assert.match(governoSource, /router\.put\('\/attuale\/:ruolo'\, verifyToken, requireAdmin, async/);
});

test('institutional directory middleware permits only admin and institution roles', () => {
  assert.match(authSource, /const requireAdminOrInstitution = async/);
  assert.match(authSource, /\['AD', 'I'\]\.includes\(req\.userRole\)/);
  assert.match(authSource, /requireAdminOrInstitution,/);
});

test('municipal-councillor discovery requires the institutional directory guard', () => {
  assert.match(
    userSearchSource,
    /router\.get\('\/consiglieri-comunali'\, verifyToken, requireAdminOrInstitution, async/
  );
});

test('municipal-councillor response is data-minimized and does not expose email', () => {
  assert.match(userSearchSource, /SELECT id, nome, cognome, comune_elezione/);
  assert.doesNotMatch(userSearchSource, /SELECT id, nome, cognome, email, comune_elezione/);
  assert.doesNotMatch(consiglieriUiSource, /email: string;/);
});

test('government edit controls do not treat activists as admins', () => {
  assert.match(governoUiSource, /const isAdmin = user\?\.ruolo === "AD";/);
  assert.doesNotMatch(governoUiSource, /user\?\.ruolo === "A"/);
});

test('municipal-councillor autocomplete queries only for admin or institution users', () => {
  assert.match(
    consiglieriUiSource,
    /const canUseInstitutionalDirectory = user\?\.ruolo === "AD" \|\| user\?\.ruolo === "I";/
  );
  assert.match(
    consiglieriUiSource,
    /if \(!user\?\.id \|\| !canUseInstitutionalDirectory\) return \{ consiglieri: \[\] \};/
  );
  assert.match(consiglieriUiSource, /enabled: !!user\?\.id && canUseInstitutionalDirectory/);
});
