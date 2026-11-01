'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collectMinisteroNewInitiatives, isCivicEventCollectionEnabled } =
  require('../services/civicNewInitiativeEventCollector');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('event discovery is disabled by default and does not read DB', async () => {
  assert.equal(isCivicEventCollectionEnabled({}), false);
  assert.equal(isCivicEventCollectionEnabled({ CIVIC_NEW_INITIATIVE_EVENTS_ENABLED: 'true' }), true);
  let calls = 0;
  const pool = { query: async () => { calls++; throw new Error('unexpected SQL'); } };
  assert.deepEqual(await collectMinisteroNewInitiatives(pool, { enabled: false }), {
    enabled: false, recorded: 0
  });
  assert.equal(calls, 0);
});

test('Ministero collection queries only official ongoing records and is idempotent', async () => {
  let sql = '';
  const pool = {
    query: async (query) => { sql = query; return { rowCount: 2, rows: [{ id: 1 }, { id: 2 }] }; }
  };
  const result = await collectMinisteroNewInitiatives(pool, { enabled: true });
  assert.deepEqual(result, { enabled: true, recorded: 2 });
  assert.match(sql, /FROM iniziative_ministero AS m/);
  assert.match(sql, /m\.id_ministero IS NOT NULL/);
  assert.match(sql, /lower\(m\.stato\) = 'in_corso'/);
  assert.match(sql, /m\.data_fine >= CURRENT_DATE/);
  assert.match(sql, /ON CONFLICT \(category, official_id\) DO NOTHING/);
  assert.match(sql, /RETURNING id/);
  assert.doesNotMatch(sql, /FROM users\b|FROM notifiche_preferenze\b/);
});

test('schema starts all three opt-ins false and suppresses historical backfill', () => {
  const migration = read('api/database/20261101_civic_new_initiative_notifications.sql');
  for (const flag of ['iniziative_popolari', 'referendum_abrogativi', 'eci']) {
    assert.match(migration, new RegExp('ADD COLUMN IF NOT EXISTS ' + flag + ' BOOLEAN NOT NULL DEFAULT FALSE'));
  }
  assert.match(migration, /UNIQUE \(category, official_id\)/);
  assert.match(migration, /'suppressed'/);
  assert.match(migration, /ALTER TABLE civic_new_initiative_notifications ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE civic_new_initiative_notifications FROM PUBLIC/);
  assert.match(migration, /ON CONFLICT \(category, official_id\) DO NOTHING/g);
  assert.doesNotMatch(migration, /messaging\(\)|sendEachForMulticast/);
});

test('API preserves civic selections from an older client which omits the new fields', () => {
  const route = read('api/routes/notifiche.js');
  const ui = read('client/src/pages/NotifichePreferenze.tsx');
  for (const key of ['iniziative_popolari', 'referendum_abrogativi', 'eci']) {
    assert.match(route, new RegExp(key + ' = COALESCE\\('));
    assert.match(ui, new RegExp(key + ': false'));
    assert.match(ui, new RegExp('key: "' + key + '" as const'));
  }
  assert.match(route, /return value === undefined \|\| value === null \? null/);
});

test('ECI compares official IDs before replacing the cache; no SMS/push dispatch', () => {
  const script = read('api/scripts/sync_eci.py');
  const workflow = read('.github/workflows/eci_sync.yml');
  assert.ok(script.indexOf('cur.execute("SELECT id FROM eci")') < script.indexOf('cur.execute("DELETE FROM eci")'));
  assert.match(script, /for row in records if row\[0\] not in previous_ids/);
  assert.match(script, /ON CONFLICT \(category, official_id\) DO NOTHING/);
  assert.match(workflow, /CIVIC_NEW_INITIATIVE_EVENTS_ENABLED: \$\{\{ vars\.CIVIC_NEW_INITIATIVE_EVENTS_ENABLED \}\}/);
});
