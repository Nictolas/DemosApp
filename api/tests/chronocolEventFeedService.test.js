'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  approvedFeedUrl, mapEvent, normalizePayload, notExpired,
  retrieve, visibleInTerritory, mergeEvents
} = require('../services/chronocolEventFeedService');

test('source cannot be changed to an arbitrary HTTPS host or private address', () => {
  assert.equal(approvedFeedUrl('https://evil.example/feed.json'), null);
  assert.equal(approvedFeedUrl('http://mobilitazioni.chronocol.com/feed'), null);
  assert.equal(approvedFeedUrl('https://mobilitazioni.chronocol.com:8443/feed'), null);
  assert.equal(approvedFeedUrl('https://mobilitazioni.chronocol.com/feed.json'),
    'https://mobilitazioni.chronocol.com/feed.json');
});

test('normalizes an approved JSON or GeoJSON payload to existing DEMOS event fields', () => {
  const row = { id: 'ev-1', title: 'Corteo a Pisa', start_at: '2026-11-05T14:30:00+01:00',
    city: 'Pisa', province: 'Pisa', region: 'Toscana', link: '/evento/ev-1' };
  const event = mapEvent(row);
  assert.equal(event.nome_evento, 'Corteo a Pisa');
  assert.equal(event.giorno_inizio, '2026-11-05');
  assert.equal(event.orario_inizio, '14:30');
  assert.equal(event.comune_evento, 'Pisa');
  assert.equal(event.fonte_url, 'https://mobilitazioni.chronocol.com/evento/ev-1');
  assert.equal(event.external_import, true);
  assert.equal(event.creator_user_id, undefined);

  const items = normalizePayload({ features: [{ type: 'Feature', id: 'ev-1', properties: row }, { ...row }] });
  assert.equal(items.length, 1);
  assert.throws(() => normalizePayload({ error: 'unauthorized' }), /Formato feed/);
  assert.equal(mapEvent({ title: 'Senza data' }), null);
});

test('hides expired events (including end time) without deleting native DEMOS events', () => {
  const now = new Date('2026-10-29T16:00:00Z'); // 17:00 Italia
  assert.equal(notExpired({ giorno_inizio: '2026-10-28' }, now), false);
  assert.equal(notExpired({ giorno_inizio: '2026-10-29', orario_fine: '16:00' }, now), false);
  assert.equal(notExpired({ giorno_inizio: '2026-10-29' }, now), true);
  assert.equal(notExpired({ giorno_inizio: '2026-10-28', giorno_fine: '2026-10-30' }, now), true);
});

test('territorial personalization, de-duplication and source-only read access', () => {
  const future = { id: 'chronocol:1', nome_evento: 'Presidio locale', giorno_inizio: '2026-11-02',
    comune_evento: 'Pisa', regione_evento: 'Toscana', external_import: true };
  const user = { comune_residenza: 'Pisa', provincia_residenza: 'Pisa', regione_residenza: 'Toscana' };
  assert.equal(visibleInTerritory(future, user), true);
  assert.equal(visibleInTerritory({ ...future, comune_evento: 'Milano', regione_evento: 'Lombardia' }, user), false);
  const native = [{ id: 'native-1', nome_evento: 'Presidio locale', giorno_inizio: '2026-11-02', comune_evento: 'Pisa' }];
  assert.deepEqual(mergeEvents(native, [future], { user, now: new Date('2026-10-29T12:00:00Z') }), native);
  assert.equal(mergeEvents([], [future], { user, now: new Date('2026-10-29T12:00:00Z') }).length, 1);
});

test('import remains disabled by default and caches one upstream download for all users', async () => {
  const oldEnabled = process.env.CHRONOCOL_IMPORT_ENABLED;
  const oldUrl = process.env.CHRONOCOL_EVENTS_JSON_URL;
  let fetchCalls = 0;
  const fetchMock = async (_url, options) => {
    fetchCalls++;
    assert.equal(options.redirect, 'error');
    assert.equal(options.size, 2 * 1024 * 1024);
    return { ok: true, json: async () => ({ events: [{
      id: 'demo-test-2026', title: 'Incontro', date: '2026-11-12', city: 'Pisa'
    }] }) };
  };
  try {
    delete process.env.CHRONOCOL_IMPORT_ENABLED;
    assert.deepEqual(await retrieve(fetchMock), []);
    process.env.CHRONOCOL_IMPORT_ENABLED = 'true';
    process.env.CHRONOCOL_EVENTS_JSON_URL = 'https://mobilitazioni.chronocol.com/feed.json';
    const current = new Date('2026-10-29T12:00:00Z');
    const first = await retrieve(fetchMock, current);
    const second = await retrieve(fetchMock, current);
    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
    assert.equal(fetchCalls, 1);
  } finally {
    if (oldEnabled === undefined) delete process.env.CHRONOCOL_IMPORT_ENABLED;
    else process.env.CHRONOCOL_IMPORT_ENABLED = oldEnabled;
    if (oldUrl === undefined) delete process.env.CHRONOCOL_EVENTS_JSON_URL;
    else process.env.CHRONOCOL_EVENTS_JSON_URL = oldUrl;
  }
});
