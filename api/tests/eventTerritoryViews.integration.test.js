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

test('personal preserves followed subjects and extends local events to the entire province, sorted by date', () => {
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
    ['provincial', 'local', 'selected']
  );
  assert.deepEqual(
    composeTerritorialEvents(personal, publicApproved, person, 'regional').map((row) => row.id),
    ['regional', 'provincial', 'local']
  );
  assert.deepEqual(
    composeTerritorialEvents(personal, publicApproved, person, 'global').map((row) => row.id),
    ['global', 'regional', 'provincial', 'local']
  );
});

test('Eventi displays elections and mobilizations in date order across every tab, regardless of feed priority', () => {
  const entries = [
    { id: 'pisa-2028', nome_evento: 'Elezioni Pisa', tipologia_evento: 'Elezioni',
      regione_evento: 'TO', giorno_inizio: '2028-05-26', feed_priority: 0 },
    { id: 'europa-2029', nome_evento: 'Elezioni Europee 2029', tipologia_evento: 'Elezioni',
      regione_evento: 'TO', giorno_inizio: '2029-12-22', feed_priority: 0 },
    { id: 'italia-2027', nome_evento: 'Elezioni Italiane 2027', tipologia_evento: 'Elezioni',
      regione_evento: 'TO', giorno_inizio: '2027-12-22', feed_priority: 2 },
    { id: 'mobilitazione-2027', tipologia_evento: 'Mobilitazione', regione_evento: 'TO',
      giorno_inizio: '2027-11-10', feed_priority: 2 },
  ];
  const originalOrder = entries.map(({ id }) => id);
  const expected = ['mobilitazione-2027', 'italia-2027', 'pisa-2028', 'europa-2029'];
  for (const view of ['personal', 'regional', 'global']) {
    assert.deepEqual(
      composeTerritorialEvents(entries, entries, person, view).map(({ id }) => id),
      expected,
      view + ' must show the closest upcoming event first'
    );
  }
  // Il riordino non deve alterare l'array già presente nella cache.
  assert.deepEqual(entries.map(({ id }) => id), originalOrder);
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


test('single-day Eventi cards show a time range once, without duplicate clock rows', () => {
  const page = fs.readFileSync(path.join(root, 'client/src/pages/Eventi.tsx'), 'utf8');
  const start = page.indexOf('{/* Date e Orari - Solo per eventi non "Elezioni" */}');
  const end = page.indexOf('{/* Per eventi "Elezioni" - Mostra date disponibili */}', start);
  assert.ok(start >= 0 && end > start, 'Eventi date display section missing');
  const dates = page.slice(start, end);

  assert.ok(dates.includes("? 'Inizio: ' : 'Quando: '"));
  assert.ok(dates.includes('formatDate(evento.giorno_inizio)'));
  assert.ok(dates.includes('formatTime(evento.orario_inizio)'));
  assert.ok(dates.includes('formatTime(evento.orario_fine)'));
  assert.doesNotMatch(dates, /Orario inizio:|Orario fine:/);
  assert.doesNotMatch(dates, /Orari senza secondo giorno/);
  assert.ok(dates.includes('evento.giorno_fine && evento.giorno_fine !== evento.giorno_inizio'),
    'Multi-day events retain their separate end date');
});

test('Chrono strike events use Sciopero badge without redundant description', () => {
  const page = fs.readFileSync(path.join(root, 'client/src/pages/Eventi.tsx'), 'utf8');
  const fromCards = page.indexOf('eventi.map((evento: any)');
  const toDialogs = page.indexOf('/* Modal per modificare evento */', fromCards);
  assert.ok(fromCards !== -1 && toDialogs > fromCards);
  const cards = page.slice(fromCards, toDialogs);
  assert.match(cards, /evento\.sciopero === true \? 'Sciopero' : 'Mobilitazione'/);
  assert.doesNotMatch(cards, /Evento collegato a uno sciopero/);
  assert.match(cards, /evento\.external_import && \(/);
});

test('Eventi category badges use distinct colors and share a top-right position', () => {
  const page = fs.readFileSync(path.join(root, 'client/src/pages/Eventi.tsx'), 'utf8');
  const start = page.indexOf('{/* Titolo a sinistra, targhetta sempre in alto a destra.');
  const end = page.indexOf('{/* Organizzatore - Solo per eventi non "Elezioni" */}', start);
  assert.ok(start !== -1 && end > start, 'Event card header must exist');
  const header = page.slice(start, end);

  assert.match(header, /className="mb-3 flex items-start justify-between gap-3"/);
  assert.match(header, /className="flex shrink-0 flex-col items-end gap-1\.5"/);
  assert.match(header, /evento\.sciopero === true\s*\? 'border-rose-200 bg-rose-100 text-rose-800'\s*: 'border-purple-200 bg-purple-100 text-purple-800'/);
  assert.match(header, /evento\.sciopero === true \? 'Sciopero' : 'Mobilitazione'/);
  assert.match(header, /bg-yellow-200[^"]*">\s*Elezioni\s*<\/span>/);
  assert.doesNotMatch(header, /Elezioni –|Politiche nazionali \(Camera e Senato\)/);
  const badge = header.indexOf('border-yellow-300 bg-yellow-200');
  const actionGroup = header.indexOf('role="group" aria-label="Azioni evento"');
  assert.ok(badge !== -1 && actionGroup > badge, 'Edit/delete actions must be below election badge');
  assert.match(header, /onClick=\{\(\) => editEvent\(evento\)\}/);
  assert.match(header, /onClick=\{\(\) => deleteEvent\(evento\.id\)\}/);
  assert.match(header, /aria-label="Modifica evento"/);
  assert.match(header, /aria-label="Elimina evento"/);
});


test('local Eventi territory changes only local events, not followed subjects or electoral events', () => {
  const residence = { provincia: 'PI', regione: 'TO' };
  const second = { provincia: 'Milano', regione: 'Lombardia' };
  const personal = [
    { id: 'residence', comune_evento: 'Pisa', giorno_inizio: '2027-01-01',
      feed_reason: 'TERRITORY' },
    { id: 'followed', comune_evento: 'Roma', giorno_inizio: '2027-01-04',
      feed_reason: 'SELECTED_SUBJECT' },
    { id: 'election', comune_evento: 'Pisa', giorno_inizio: '2027-01-05',
      tipologia_evento: 'Elezioni', feed_reason: 'RELEVANT_ELECTION' }
  ];
  const publicEvents = [
    { id: 'milano', comune_evento: 'Milano', giorno_inizio: '2027-01-02' },
    { id: 'pontedera', comune_evento: 'Pontedera', giorno_inizio: '2027-01-03' }
  ];
  const eventIds = (preference) =>
    composeTerritorialEvents(personal, publicEvents, residence, 'personal', preference)
      .map((event) => event.id);
  assert.deepEqual(eventIds({ mode: 'residenza', territory: second }),
    ['residence', 'pontedera', 'followed', 'election']);
  assert.deepEqual(eventIds({ mode: 'altro', territory: second }),
    ['milano', 'followed', 'election']);
  assert.deepEqual(eventIds({ mode: 'entrambi', territory: second }),
    ['residence', 'milano', 'pontedera', 'followed', 'election']);
  assert.deepEqual(
    composeTerritorialEvents(personal, publicEvents, residence, 'regional',
      { mode: 'altro', territory: second }).map((event) => event.id),
    ['pontedera']
  );
});

test('GPS geographical reference is static, contains all Italian regions, and has no personal records', () => {
  const records = [1, 2, 3, 4].flatMap((index) =>
    JSON.parse(fs.readFileSync(
      path.join(root, 'client/src/data/municipalityCentroids-' + index + '.json'),
      'utf8'
    ))
  );
  assert.ok(records.length >= 7800, 'all municipality centroids must be included');
  assert.equal(new Set(records.map((row) => row[2])).size, 20);
  for (const row of records) {
    assert.equal(row.length, 5);
    assert.ok(typeof row[0] === 'string' && row[0].length > 0);
    assert.ok(typeof row[1] === 'string' && row[1].length > 0);
    assert.ok(typeof row[2] === 'string' && row[2].length > 0);
    assert.ok(Number.isFinite(row[3]) && Number.isFinite(row[4]));
  }
  assert.ok(records.some((row) => row[0] === 'Pisa' && row[1] === 'Pisa'));
  const manifest = fs.readFileSync(path.join(root, 'client/android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /android\\.permission\\.ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /android\\.permission\\.ACCESS_FINE_LOCATION/);
  assert.doesNotMatch(manifest, /ACCESS_BACKGROUND_LOCATION/);
});

test('GPS location and Eventi preferences remain local with no new endpoint', async () => {
  const data = [1, 2, 3, 4].map((index) => JSON.parse(fs.readFileSync(
    path.join(root, 'client/src/data/municipalityCentroids-' + index + '.json'), 'utf8'
  )));
  const imports = {
    '@/utils/eventTerritoryView': { territoryOfEvent },
    ...Object.fromEntries(data.map((rows, i) => [
      '@/data/municipalityCentroids-' + (i + 1) + '.json',
      { __esModule: true, default: rows }
    ]))
  };
  const localArea = compileFile('client/src/utils/localEventArea.ts', imports);
  const originalWindow = global.window;
  const saved = new Map();
  global.window = { localStorage: {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value)
  } };
  try {
    const pisa = data.flat().find((row) => row[0] === 'Pisa' && row[1] === 'Pisa');
    const result = await localArea.approximateMunicipalityOnDevice(pisa[3], pisa[4]);
    assert.deepEqual(result, { comune: 'Pisa', provincia: 'Pisa', regione: 'Toscana' });
    assert.equal(await localArea.approximateMunicipalityOnDevice(0, 0), null);
    const pref = { mode: 'altro', area: result, source: 'gps', onboardingSeen: true };
    assert.equal(localArea.writeLocalEventPreferences('user-one', pref), true);
    assert.deepEqual(localArea.readLocalEventPreferences('user-one'), pref);
    assert.equal(localArea.readLocalEventPreferences('user-two').mode, 'residenza');
    assert.ok(!JSON.stringify([...saved.values()]).includes(String(pisa[3])),
      'do not persist GPS latitude or longitude');
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
