'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const ts = require(path.join(root, 'client/node_modules/typescript'));

function compileFile(relativePath, imports = {}) {
  const filename = path.join(root, relativePath);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: filename
  }).outputText;
  const moduleLike = { exports: {} };
  const localRequire = (name) => {
    if (!Object.hasOwn(imports, name)) throw new Error('Unexpected import: ' + name);
    return imports[name];
  };
  // L'esecuzione riguarda soltanto codice locale già presente nel repository.
  new Function('require', 'module', 'exports', js)(
    localRequire, moduleLike, moduleLike.exports
  );
  return moduleLike.exports;
}

const italy = compileFile('client/src/data/italyData.ts');
const geo = compileFile('client/src/utils/eventiGeographicUtils.ts');
const {
  territoryOfEvent, isInEventProvince, isInEventRegion, composeTerritorialEvents
} = compileFile('client/src/utils/eventTerritoryView.ts', {
  '@/data/italyData': italy,
  '@/utils/eventiGeographicUtils': geo
});

const person = { provincia: 'PI', regione: 'TO' };

test('Italian territorial registry resolves the province of cities, not just the city itself', () => {
  const pontedera = { id: 'p', comune_evento: 'Pontedera' };
  const cascina = { id: 'c', comune_evento: 'Cascina' };
  const firenze = { id: 'f', comune_evento: 'Firenze' };
  const bologna = { id: 'b', comune_evento: 'Bologna' };
  assert.deepEqual(territoryOfEvent(pontedera), { provincia: 'Pisa', regione: 'Toscana' });
  assert.equal(isInEventProvince(cascina, person), true);
  assert.equal(isInEventProvince(pontedera, person), true);
  assert.equal(isInEventProvince(firenze, person), false);
  assert.equal(isInEventRegion(firenze, person), true);
  assert.equal(isInEventRegion(bologna, person), false);
  assert.equal(isInEventProvince({ id: 'other', comune_evento: 'Unknown city' }, person), false);
  assert.equal(isInEventRegion({ id: 'other', comune_evento: 'Unknown city' }, person), false);
});

test('explicit region and province codes work for native DEMOS events', () => {
  const native = { id: 'a', provincia_evento: 'PI', regione_evento: 'TO' };
  assert.equal(isInEventProvince(native, person), true);
  assert.equal(isInEventRegion(native, person), true);
  assert.equal(isInEventRegion({ id: 'other', regione_evento: 'LO' }, person), false);
});

test('personal preserves followed subjects and extends local events to the entire province', () => {
  const personal = [
    { id: 'selected', nome_evento: 'Soggetto seguito', comune_evento: 'Roma',
      giorno_inizio: '2027-03-01', feed_priority: 0, feed_reason: 'SELECTED_SUBJECT' },
  ];
  const publicApproved = [
    { id: 'local', comune_evento: 'Pisa', giorno_inizio: '2027-01-06', external_import: true },
    { id: 'provincial', comune_evento: 'Pontedera', giorno_inizio: '2027-01-03', external_import: true },
    { id: 'regional', comune_evento: 'Firenze', giorno_inizio: '2027-01-02' },
    { id: 'global', comune_evento: 'Bologna', giorno_inizio: '2027-01-01' },
  ];
  assert.deepEqual(
    composeTerritorialEvents(personal, publicApproved, person, 'personal').map((row) => row.id),
    ['selected', 'provincial', 'local']
  );
  assert.deepEqual(
    composeTerritorialEvents(personal, publicApproved, person, 'regional').map((row) => row.id),
    ['local', 'provincial', 'regional']
  );
  assert.deepEqual(
    composeTerritorialEvents(personal, publicApproved, person, 'global').map((row) => row.id),
    ['local', 'provincial', 'regional', 'global']
  );
});

test('public global uses anonymous API, and backend public SQL denies pending/rejected events', () => {
  const router = fs.readFileSync(path.join(root, 'api/routes/eventi.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'client/src/pages/Eventi.tsx'), 'utf8');
  assert.match(client, /getApiUrl\("\/api\/eventi\/pubblici"\)/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /'personal' \| 'regional' \| 'global'/);
  assert.doesNotMatch(client, /setActiveTab\('mobilitazioni'\)/);
  const start = router.indexOf("router.get('/pubblici', async (_req, res) => {");
  const end = router.indexOf("// GET /api/eventi/mobilitazioni", start);
  assert.ok(start >= 0 && end > start);
  const publicRoute = router.slice(start, end);
  assert.doesNotMatch(publicRoute, /verifyToken|req\.user|SELECT.*FROM users/);
  assert.match(router, /WHERE approval_status = 'APPROVED'/);
  assert.doesNotMatch(publicRoute, /res\.json\(\{\s*success:\s*true,\s*data:\s*result\.rows/);
  assert.match(publicRoute, /Cache-Control/);
  assert.match(router, /router\.get\('\/', verifyToken/);
});

test('Chrono source attribution is displayed only once, not inside each event card', () => {
  const client = fs.readFileSync(path.join(root, 'client/src/pages/Eventi.tsx'), 'utf8');
  const cardBlock = client.slice(client.indexOf('eventi.map((evento: any)'), client.indexOf('/* Modal per modificare evento */'));
  assert.doesNotMatch(cardBlock, /Fonte: Chrono Collective/);
  assert.match(cardBlock, /Dati delle mobilitazioni:/);
  assert.equal((cardBlock.match(/Dati delle mobilitazioni:/g) || []).length, 1);
  assert.match(cardBlock, /https:\/\/mobilitazioni\.chronocol\.com\//);
  assert.match(cardBlock, /evento\.external_import \? 'Fine: '/);
  assert.match(cardBlock, /evento\.external_import && evento\.orario_fine/);
});
