'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  FIELDS, buildPageUrl, mapEvent, normalizePayload, notExpired,
  loadAllPages, retrieve, visibleInTerritory, mergeEvents
} = require('../services/chronocolEventFeedService');

const raw = (id, overrides = {}) => ({
  id, documentId: 'chronocol-test-' + id, TIPO: 'Corteo',
  CITTA: 'Pisa', DATA_ORARIO: '2026-11-05T13:30:00.000Z',
  FINE_EFFETTIVA: '2026-11-05T16:30:00.000Z',
  DATA_FINE: null, INDIRIZZO: 'Piazza dei Miracoli',
  VERIFICATA: true, ANNULLATA: false, LATITUDE: 43.723, LONGITUDE: 10.396,
  SCIOPERO: true, ...overrides
});
const page = (data, number = 1, pageCount = 1) => ({
  data, meta: { pagination: { page: number, pageSize: 100, pageCount, total: pageCount * 100 } }
});

test('official Chrono API query selects minimum public fields, verification and excludes contacts', () => {
  const url = new URL(buildPageUrl(1));
  assert.equal(url.origin, 'https://mobilitazioni.chronocol.com');
  assert.equal(url.pathname, '/api/w-mobs');
  assert.equal(url.searchParams.get('filters[VERIFICATA][$eq]'), 'true');
  assert.equal(url.searchParams.get('filters[ANNULLATA][$eq]'), 'false');
  assert.equal(url.searchParams.get('pagination[pageSize]'), '100');
  assert.equal(url.searchParams.get('pagination[page]'), '1');
  assert.ok(FIELDS.includes('DATA_ORARIO'));
  for (const privateField of ['CONTATTI', 'DESCRIZIONE', 'ACCESSIBILITA', 'MEZZI']) {
    assert.ok(!FIELDS.includes(privateField), privateField);
    assert.ok(!url.href.includes(privateField), privateField);
  }
  assert.throws(() => buildPageUrl(0), /Invalid Chrono page/);
  assert.throws(() => buildPageUrl(9999), /Invalid Chrono page/);
});

test('Strapi records map to the existing DEMOS Eventi card and Europe/Rome dates', () => {
  const event = mapEvent(raw(1));
  assert.equal(event.nome_evento, 'Corteo a Pisa');
  assert.equal(event.giorno_inizio, '2026-11-05');
  assert.equal(event.orario_inizio, '14:30');
  assert.equal(event.orario_fine, '17:30');
  assert.equal(event.comune_evento, 'Pisa');
  assert.equal(event.tipologia_evento, 'Mobilitazione');
  assert.equal(event.sciopero, true);
  assert.equal(event.fonte_url, 'https://mobilitazioni.chronocol.com/e/chronocol-test-1');
  assert.equal(event.external_import, true);
  assert.equal(event.creator_user_id, undefined);
  assert.equal(event.CONTATTI, undefined);
  assert.equal(event.DESCRIZIONE, undefined);
  assert.equal(event.organizzatore, undefined);
  assert.equal(event.latitude, 43.723);
});

test('unverified, cancelled and malformed entries never enter DEMOS', () => {
  const records = [raw(1), raw(2, { VERIFICATA: false }), raw(3, { ANNULLATA: true }),
    raw(4, { DATA_ORARIO: null }), raw(5, { CITTA: '' })];
  assert.equal(normalizePayload(page(records)).length, 1);
  assert.equal(mapEvent({ ...raw(8), CONTATTI: 'private@example.com' }).CONTATTI, undefined);
  assert.throws(() => normalizePayload({ data: records }), /Unexpected Chrono API format/);
  assert.throws(() => normalizePayload({ data: 'invalid', meta: { pagination: {} } }), /Unexpected Chrono API format/);
});

test('expiry considers the actual end time in Italy without deleting native events', () => {
  const now = new Date('2026-10-29T16:00:00Z'); // 17:00 Europe/Rome
  assert.equal(notExpired({ giorno_inizio: '2026-10-28' }, now), false);
  assert.equal(notExpired({ giorno_inizio: '2026-10-29', orario_fine: '16:00' }, now), false);
  assert.equal(notExpired({ giorno_inizio: '2026-10-29' }, now), true);
  assert.equal(notExpired({ giorno_inizio: '2026-10-28', giorno_fine: '2026-10-30' }, now), true);
});

test('pagination obtains the complete source without importing unnecessary fields', async () => {
  const seen = [];
  const fetchMock = async (url, options) => {
    seen.push(new URL(url).searchParams.get('pagination[page]'));
    assert.equal(options.redirect, 'error');
    assert.equal(options.size, 2 * 1024 * 1024);
    const number = Number(new URL(url).searchParams.get('pagination[page]'));
    return { ok: true, json: async () => page([raw(number)], number, 2) };
  };
  const events = await loadAllPages(fetchMock);
  assert.deepEqual(seen, ['1', '2']);
  assert.equal(events.length, 2);
  assert.notEqual(events[0].id, events[1].id);
  await assert.rejects(loadAllPages(async () => ({
    ok: true, json: async () => page([raw(5)], 1, 99)
  })), /Unexpected Chrono pagination/);
});

test('personal territorial matching, deduplication and priority sorting', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const user = { comune_residenza: 'Pisa', provincia_residenza: 'PI', regione_residenza: 'Toscana' };
  const external = mapEvent(raw(1));
  assert.equal(visibleInTerritory(external, user), true);
  assert.equal(visibleInTerritory({ ...external, comune_evento: 'Milano' }, user), false);
  const native = [
    { id: 'selected', nome_evento: 'Scelto', giorno_inizio: '2026-12-31', feed_priority: 0 },
    { id: 'native-city', nome_evento: 'Locale', comune_evento: 'Pisa',
      giorno_inizio: '2026-11-15', feed_priority: 1 },
    { id: 'election', nome_evento: 'Elezioni', giorno_inizio: '2026-11-01', feed_priority: 2 }
  ];
  const personal = mergeEvents(native, [external], { user, now });
  assert.deepEqual(personal.map((event) => event.id),
    ['selected', external.id, 'native-city', 'election']);
  assert.equal(personal[1].feed_reason, 'TERRITORY');
  assert.deepEqual(mergeEvents(native, [external], { global: true, now }).map((event) => event.id),
    ['election', external.id, 'native-city', 'selected']);

  const duplicate = { ...native[1], nome_evento: external.nome_evento,
    giorno_inizio: external.giorno_inizio, comune_evento: 'Pisa',
    indirizzo_evento: external.indirizzo_evento, orario_inizio: external.orario_inizio };
  assert.equal(mergeEvents([duplicate], [external], { user, now }).length, 1);
  const distinct = { ...external, id: 'chronocol:another', indirizzo_evento: 'Altra piazza' };
  assert.equal(mergeEvents([], [external, distinct], { global: true, now }).length, 2);
});

test('source disabled by default; when enabled upstream pages are shared in 12-hour cache', async () => {
  const oldEnabled = process.env.CHRONOCOL_IMPORT_ENABLED;
  let fetchCalls = 0;
  const fetchMock = async () => {
    fetchCalls++;
    return { ok: true, json: async () => page([raw(998)]) };
  };
  try {
    delete process.env.CHRONOCOL_IMPORT_ENABLED;
    assert.deepEqual(await retrieve(fetchMock), []);
    assert.equal(fetchCalls, 0);
    process.env.CHRONOCOL_IMPORT_ENABLED = 'true';
    const now = new Date('2026-10-29T12:00:00Z');
    const first = await retrieve(fetchMock, now);
    const second = await retrieve(fetchMock, now);
    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
    assert.equal(fetchCalls, 1);
  } finally {
    if (oldEnabled === undefined) delete process.env.CHRONOCOL_IMPORT_ENABLED;
    else process.env.CHRONOCOL_IMPORT_ENABLED = oldEnabled;
  }
});

test('public mobilizations route skips verifyToken and preserves private Eventi endpoints', () => {
  const router = fs.readFileSync(path.resolve(__dirname, '../routes/eventi.js'), 'utf8');
  const client = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/Eventi.tsx'), 'utf8');
  const publicStart = router.indexOf("router.get('/mobilitazioni', async (_req, res) => {");
  assert.ok(publicStart > -1);
  assert.ok(publicStart < router.indexOf("router.get('/', verifyToken"));
  const publicHandler = router.slice(publicStart, router.indexOf("\n});", publicStart) + 4);
  assert.doesNotMatch(publicHandler, /verifyToken|pool\.query|getFeedUser|req\.user/);
  assert.match(publicHandler, /public, max-age=60/);
  assert.match(client, /getApiUrl\("\/api\/eventi\/pubblici"\)/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /staleTime: 120_000/);
  assert.match(router, /router\.get\('\/', verifyToken/);
  assert.match(router, /router\.post\('\/', verifyToken/);
});
