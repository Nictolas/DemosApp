const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Admin authorization is capability-only after authentication normalization', () => {
  const auth = read('middleware/auth.js');
  const block = auth.slice(auth.indexOf('const requireAdmin'), auth.indexOf('const requireOwnProfile'));
  assert.match(block, /if \(!req\.user\.isAdmin\)/);
  assert.doesNotMatch(block, /req\.userRole\s*[!=]==?\s*['"]AD['"]/);
});

test('supporter private views use canonical Admin capability, not legacy role', () => {
  for (const rel of ['routes/candidati-sostenitori.js','routes/rappresentanti-sostenitori.js','routes/attivisti-sostenitori.js','routes/organizzazioni-sostenitori.js','routes/sostenitori-totale.js','routes/sostenitori.js','routes/candidati.js']) {
    const src = read(rel);
    assert.doesNotMatch(src, /req\.userRole\s*[!=]==?\s*['"]AD['"]/);
  }
});

test('support actions validate target capability/account type instead of users.ruolo', () => {
  const src = read('routes/sostenitori.js');
  assert.match(src, /getAccountSubject\(pool, supported_id\)/);
  assert.match(src, /hasCapability\(supportedSubject, 'isActivist'\)/);
  assert.match(src, /ACCOUNT_TYPES\.ORGANIZATION/);
  assert.doesNotMatch(src, /supportedUser\.ruolo/);
});

test('Attivisti and Organizzazioni directories prefer canonical account model with deployment-safe fallback', () => {
  const activists = read('routes/attivisti.js');
  const orgs = read('routes/organizzazioni.js');
  assert.match(activists, /u\.is_activist/);
  assert.match(activists, /queryWithAccountModelFallback/);
  assert.match(orgs, /u\.account_type IN \('ORGANIZATION', 'O'\)/);
  assert.match(orgs, /queryWithAccountModelFallback/);
});

test('Admin-only notification surface delegates authorization to requireAdmin', () => {
  const src = read('routes/notifiche-totali.js');
  assert.match(src, /router\.get\('\/', verifyToken, requireAdmin,/);
  assert.match(src, /router\.delete\('\/:tabella\/:id', verifyToken, requireAdmin,/);
  assert.doesNotMatch(src, /rows\[0\]\.ruolo === 'AD'/);
});

test('legacy direct role mutation is retired', () => {
  const src = read('routes/gestione-utenti-aggiuntivi.js');
  assert.match(src, /LEGACY_ROLE_MUTATION_RETIRED/);
  assert.doesNotMatch(src, /UPDATE users SET ruolo = \$1/);
});

test('report Admin discovery prefers is_admin with legacy fallback only for pre-migration schema', () => {
  const src = read('routes/segnalazioni.js');
  assert.match(src, /WHERE is_admin = TRUE/);
  assert.match(src, /queryWithAccountModelFallback/);
});


test('political Opinion privacy uses requester/target capabilities rather than role strings', () => {
  const src = read('routes/users/profile.js');
  assert.match(src, /getAccountSubject\(pool, userId\)/);
  assert.match(src, /req\.user\?\.isAdmin/);
  assert.match(src, /targetSubject\.capabilities\?\.isPolitician/);
  assert.match(src, /targetSubject\.capabilities\?\.isCandidate/);
  assert.doesNotMatch(src, /requesterRole: req\.userRole/);
});

test('Admin user editor cannot write legacy ruolo projection', () => {
  const src = read('routes/users/search.js');
  assert.match(src, /LEGACY_ROLE_MUTATION_RETIRED/);
  const put = src.slice(src.indexOf("router.put('/:userId'"));
  assert.doesNotMatch(put, /'cittadinanza', 'ruolo'/);
});

test('municipal councillor discovery prefers active canonical mandates', () => {
  const src = read('routes/users/search.js');
  assert.match(src, /JOIN political_mandates pm ON pm\.user_id = u\.id/);
  assert.match(src, /pm\.office_code = 'CO'/);
  assert.match(src, /queryWithAccountModelFallback/);
});

test('parliamentary politician resolution prefers active canonical mandates', () => {
  const votes = read('routes/voti-politici.js');
  const camera = read('routes/voti-camera.js');
  assert.match(votes, /political_mandates pm/);
  assert.match(votes, /pm\.office_code = \$2/);
  assert.match(camera, /JOIN LATERAL[\s\S]*political_mandates pm/);
  assert.match(camera, /pm\.office_code IN \('C', 'S'\)/);
});

test('global Admin count prefers is_admin capability', () => {
  const src = read('routes/statistiche.js');
  assert.match(src, /is_admin = TRUE/);
  assert.match(src, /queryWithAccountModelFallback/);
});
