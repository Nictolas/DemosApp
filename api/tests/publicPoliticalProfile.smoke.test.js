const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const route = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'users', 'public-profile.js'), 'utf8');
const usersIndex = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'users', 'index.js'), 'utf8');
const hook = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Profilo', 'hooks', 'useProfileData.ts'), 'utf8').replace(/\r\n/g, '\n');
const profileInfo = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Profilo', 'components', 'ProfileInfo.tsx'), 'utf8');
const profilePage = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Profilo', 'index.tsx'), 'utf8');
const representatives = fs.readFileSync(path.join(ROOT, 'client', 'src', 'components', 'ProfileRepresentatives.tsx'), 'utf8');
const candidates = fs.readFileSync(path.join(ROOT, 'client', 'src', 'components', 'ProfileCandidates.tsx'), 'utf8');

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('public P/C projection is dedicated, authenticated and does not alias the Admin user endpoint', () => {
  assert.match(route, /router\.get\('\/:userId\/public-profile', \(_req, res, next\) =>/);
  assert.match(route, /\}, verifyToken, async \(req, res\) =>/);
  assert.match(route, /Cache-Control', 'private, no-store, max-age=0'/);
  assert.match(route, /const \{ verifyToken \} = require/);
  assert.match(route, /getAccountSubject\(pool, userId\)/);
  assert.match(route, /isPolitician/);
  assert.match(route, /isCandidate/);
  assert.match(route, /Profilo pubblico non disponibile/);

  const publicMount = usersIndex.indexOf("router.use('/', publicProfileRoutes);");
  const searchMount = usersIndex.indexOf("router.use('/', searchRoutes);");
  assert.ok(publicMount >= 0 && searchMount >= 0 && publicMount < searchMount);
});

test('public projection source excludes private identity and residence fields', () => {
  for (const privateField of [
    'email',
    'data_nascita',
    'genere',
    'cittadinanza',
    'paese_residenza',
    'regione_residenza',
    'provincia_residenza',
    'comune_residenza',
    'telefono',
  ]) {
    assert.doesNotMatch(route, new RegExp(`\\b${privateField}\\b`), privateField);
  }
  assert.match(route, /grado_elezione/);
  assert.match(route, /grado_candidatura/);
  assert.match(route, /avatar_config/);
});

test('public projection returns target political selections and target ideal government', () => {
  assert.match(route, /loadSelectionDetails\(rawUser, REPRESENTATIVE_FIELDS\)/);
  assert.match(route, /loadSelectionDetails\(rawUser, CANDIDATE_FIELDS\)/);
  assert.match(route, /loadIdealGovernment\(userId\)/);
  assert.match(route, /WHERE v\.userid::text = \$1::text/);
  assert.match(route, /getPoliticalConsentState\(pool, userId\)/);
  assert.match(route, /COALESCE\(/);
  assert.match(route, /rappresentanti,/);
  assert.match(route, /candidati,/);
  assert.match(route, /governoIdeale: finalConsent\.granted \? governoIdeale : \{\}/);
});

test('other-profile client uses the target projection instead of the viewer Admin/private endpoint', () => {
  assert.match(hook, /`\/api\/users\/\$\{targetUserId\}\/public-profile`/);
  assert.doesNotMatch(hook, /`\/api\/users\/\$\{userId\}`/);
  assert.match(hook, /response\.data\.public\?\.rappresentanti/);
  assert.match(hook, /response\.data\.public\?\.candidati/);
  assert.match(hook, /response\.data\.public\?\.governoIdeale/);

  const ownOnly = sliceBetween(
    hook,
    'if (isOwnProfile) {\n        const [governoResponse',
    '    } catch (profileError)'
  );
  assert.match(ownOnly, /\/api\/governo\/ideale/);
  assert.match(ownOnly, /\/api\/rappresentanti/);
  assert.match(ownOnly, /\/api\/candidati\/selezioni/);
});

test('target political opinions are converted from the target-aware endpoint payload', () => {
  assert.match(hook, /`\/api\/users\/\$\{targetUserId\}\/opinioni`/);
  assert.match(hook, /Array\.isArray\(payload\.opinioni\)/);
  assert.match(hook, /normalizeOpinionValue\(item\.userAnswer\)/);
});

test('other-profile UI hides controls for changing the viewer selections and private demographic blocks', () => {
  assert.match(profilePage, /canEditSelections=\{isViewingOwnProfile\}/);
  assert.match(profilePage, /isOwnProfile=\{isViewingOwnProfile\}/);
  assert.match(representatives, /\{canEditSelections && \(/);
  assert.match(candidates, /\{canEditSelections && \(/);
  assert.match(profileInfo, /\{isOwnProfile && \(/);
  assert.match(profileInfo, /Informazioni pubbliche del profilo politico/);
});
