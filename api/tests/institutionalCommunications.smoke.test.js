const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const apiRoute = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'comunicazioni.js'), 'utf8');
const accessHook = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Comunica', 'hooks', 'useAccessControl.ts'), 'utf8');
const formHook = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Comunica', 'hooks', 'useComunicaForm.ts'), 'utf8');
const migration = fs.readFileSync(path.join(ROOT, '20261009_institutional_vote_communications.sql'), 'utf8');

function between(src, start, end) {
  const s = src.indexOf(start);
  assert.notEqual(s, -1, `missing start marker: ${start}`);
  const e = src.indexOf(end, s + start.length);
  assert.notEqual(e, -1, `missing end marker: ${end}`);
  return src.slice(s, e);
}

test('institutional vote write is authenticated and capability-gated', () => {
  const block = between(apiRoute, "router.post('/', verifyToken", "// GET /api/comunicazioni/ultima");
  assert.match(block, /!req\.user\?\.isPolitician && !req\.user\?\.isAdmin/);
  assert.match(block, /resolveInstitutionalCommunicationTarget/);
  assert.match(block, /tipo !== 'votazione'/);
  assert.doesNotMatch(block, /tipo === 'demos_notification'/);
  assert.doesNotMatch(block, /tipo === 'istituzione'/);
});

test('normal users cannot choose another politician as author', () => {
  assert.match(apiRoute, /!req\.user\?\.isAdmin && requestedTargetId/);
  assert.match(apiRoute, /Non puoi comunicare voti istituzionali per un altro utente/);
  assert.match(apiRoute, /subject\?\.capabilities\?\.isPolitician/);
});

test('institutional votes are deduplicated atomically and do not use 3-point legacy scoring', () => {
  const block = between(apiRoute, "router.post('/', verifyToken", "// GET /api/comunicazioni/ultima");
  assert.match(block, /institutional_vote_key/);
  assert.match(block, /ON CONFLICT \(id_utente, institutional_vote_key\)/);
  assert.match(block, /punti_trasparenza = 0/);
  assert.doesNotMatch(block, /punti_trasparenza[^\n]*3/);
});

test('communication migration supports the five 90-day podium dimensions efficiently', () => {
  for (const level of ['EUROPEO', 'CAMERA', 'SENATO', 'REGIONE', 'COMUNE']) {
    assert.match(migration, new RegExp(level));
  }
  assert.match(migration, /uq_comunicazioni_politician_vote_key/);
  assert.match(migration, /idx_comunicazioni_transparency_window/);
  assert.match(migration, /vote_date DESC/);
});

test('manual notification endpoints are Admin-only', () => {
  assert.match(apiRoute, /send-demos-notification[\s\S]*?verifyToken, requireAdmin/);
  assert.match(apiRoute, /send-user-notification[\s\S]*?verifyToken, requireAdmin/);
});

test('Comunica client excludes standalone candidates and does not issue duplicate-check requests', () => {
  assert.match(accessHook, /const hasAdvancedAccess = isPolitician \|\| isAdmin/);
  assert.doesNotMatch(accessHook, /hasAdvancedAccess[^\n]*userRole === "C"/);
  assert.doesNotMatch(formHook, /check-duplicate/);
  assert.doesNotMatch(formHook, /generateZona/);
  assert.match(formHook, /data_votazione/);
});

test('own latest institutional communication uses authenticated identity', () => {
  const block = between(apiRoute, "router.get('/ultima', verifyToken", "// Funzione per notificare i sostenitori");
  assert.match(block, /\[req\.userId\]/);
  assert.doesNotMatch(block, /req\.query/);
});


test('Informa Cittadini uses authenticated identity and one OFFICIAL canonical municipality', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'informa-cittadini.js'), 'utf8');
  const service = fs.readFileSync(path.join(ROOT, 'api', 'services', 'municipalInstitutionCommunicationService.js'), 'utf8');
  const feed = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'notifiche.js'), 'utf8');
  const client = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'InformaCittadini.tsx'), 'utf8');
  const municipalMigration = fs.readFileSync(path.join(ROOT, '20261010_municipal_institutional_communications.sql'), 'utf8');

  assert.match(src, /router\.post\('\/', verifyToken,/);
  assert.match(src, /authorizeMunicipalInstitutionSender/);
  assert.match(src, /INSERT INTO institutional_territorial_notices/);
  assert.match(src, /req\.user\.id/);
  assert.doesNotMatch(src, /id_utente.*req\.body/);
  assert.doesNotMatch(src, /INSERT INTO notifiche_comunali/);

  assert.match(service, /verification_level[^\n]*OFFICIAL|verificationLevel: OFFICIAL/);
  assert.match(service, /accountType === 'INSTITUTION' \|\| user\?\.isAdmin === true/);
  assert.match(service, /CANONICAL_TERRITORY_REQUIRED/);
  assert.match(service, /MUNICIPAL_AUTHORITY_CONFLICT/);

  assert.match(feed, /loadCanonicalMunicipalityTargets/);
  assert.match(feed, /FROM institutional_territorial_notices n/);
  assert.match(feed, /target\.territory_code = n\.territory_code/);
  assert.doesNotMatch(client, /id_utente:\s*user\.id/);
  assert.match(client, /account_type === "INSTITUTION"/);

  assert.match(municipalMigration, /CREATE TABLE IF NOT EXISTS institutional_territorial_notices/);
  assert.match(municipalMigration, /authority_verification_level = 'OFFICIAL'/);
  assert.match(municipalMigration, /ENABLE ROW LEVEL SECURITY/);
});
