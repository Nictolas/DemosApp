const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProfileFingerprint,
  syncItalianPoliticalTerritoriesFromProfiles,
} = require('../services/politicalTerritoryResolverService');

function profile(id, municipality, overrides = {}) {
  const row = {
    id,
    paese_residenza: 'IT',
    regione_residenza: 'TO',
    provincia_residenza: 'PI',
    comune_residenza: municipality,
    ...overrides,
  };
  row.resolver_context = {
    profileFingerprint: buildProfileFingerprint(row),
  };
  return row;
}

test('territory sync is inert when the canonical migration is absent', async () => {
  const db = { query: async (sql) => {
    assert.match(String(sql), /to_regclass/);
    return { rows: [{ relation_name: null }] };
  } };
  const result = await syncItalianPoliticalTerritoriesFromProfiles({ pool: db });
  assert.deepEqual(result, {
    available: false, scanned: 0, resolved: 0, unchanged: 0, unresolved: 0, errors: [],
  });
});

test('territory sync keyset-pages through unchanged users instead of repeating the first batch forever', async () => {
  const pages = [
    [profile('00000000-0000-0000-0000-000000000001', 'Pisa'), profile('00000000-0000-0000-0000-000000000002', 'Pisa')],
    [profile('00000000-0000-0000-0000-000000000003', 'San Giuliano Terme')],
  ];
  const pageParams = [];
  const db = { query: async (sql, params) => {
    if (/to_regclass/.test(sql)) return { rows: [{ relation_name: 'user_political_territories' }] };
    if (/FROM users u/.test(sql)) {
      pageParams.push(params);
      return { rows: pages.shift() || [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  } };

  const result = await syncItalianPoliticalTerritoriesFromProfiles({ pool: db, batchSize: 2 });
  assert.equal(result.scanned, 3);
  assert.equal(result.unchanged, 3);
  assert.equal(result.resolved, 0);
  assert.equal(pageParams.length, 2);
  assert.deepEqual(pageParams[0], [2, null]);
  assert.deepEqual(pageParams[1], [2, '00000000-0000-0000-0000-000000000002']);
});

test('territory sync resolves a changed Italian profile through Istat and persists VERIFIED memberships', async () => {
  let profilePageRead = false;
  const writes = [];
  const db = { query: async (sql, params) => {
    const text = String(sql);
    if (/to_regclass/.test(text)) return { rows: [{ relation_name: 'user_political_territories' }] };
    if (/FROM users u/.test(text)) {
      if (profilePageRead) return { rows: [] };
      profilePageRead = true;
      return { rows: [{
        id: '11111111-1111-1111-1111-111111111111',
        paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa',
        resolver_context: null,
      }] };
    }
    writes.push({ text, params });
    return { rows: [], rowCount: 1 };
  } };

  const result = await syncItalianPoliticalTerritoriesFromProfiles({ pool: db, batchSize: 10 });
  assert.equal(result.scanned, 1);
  assert.equal(result.resolved, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(writes.filter((call) => /INSERT INTO user_political_territories/.test(call.text)).length, 4);
  assert.ok(writes.filter((call) => /INSERT INTO user_political_territories/.test(call.text)).every((call) => call.params[6] === 'VERIFIED'));
});

test('territory sync reports an unknown municipality as unresolved without inventing a territory', async () => {
  const db = { query: async (sql) => {
    const text = String(sql);
    if (/to_regclass/.test(text)) return { rows: [{ relation_name: 'user_political_territories' }] };
    if (/FROM users u/.test(text)) return { rows: [{
      id: '11111111-1111-1111-1111-111111111111',
      paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Comune impossibile',
      resolver_context: null,
    }] };
    throw new Error('No writes expected for unresolved territory');
  } };
  const result = await syncItalianPoliticalTerritoriesFromProfiles({ pool: db, batchSize: 10 });
  assert.equal(result.unresolved, 1);
  assert.equal(result.resolved, 0);
});
