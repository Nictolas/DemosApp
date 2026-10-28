const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePublishedOpinionColumn } = require('../utils/opinionStatsColumns');

function createPool(published) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: published ? [{ id: params[0] }] : [] };
    },
  };
}

test('existing official opinion can be used as a statistics column', async () => {
  const pool = createPool(true);
  assert.equal(await resolvePublishedOpinionColumn(pool, 'energia_nucleare'), 'energia_nucleare');
  assert.deepEqual(pool.calls[0].params, ['energia_nucleare']);
});

test('new official opinions work without hard-coded mappings', async () => {
  const pool = createPool(true);
  assert.equal(await resolvePublishedOpinionColumn(pool, 'citta_30'), 'citta_30');
  assert.equal(await resolvePublishedOpinionColumn(pool, 'auto_emissioni_zero_2035'), 'auto_emissioni_zero_2035');
  assert.equal(pool.calls.length, 2);
});

test('missing, unpublished or schema-incomplete opinions are refused', async () => {
  const pool = createPool(false);
  assert.equal(await resolvePublishedOpinionColumn(pool, 'inesistente'), null);
  // An unknown ID is rejected from the code catalog without ANY SQL.
  assert.equal(pool.calls.length, 0);
  // Known catalog ID without a matching answer column is also rejected.
  assert.equal(await resolvePublishedOpinionColumn(pool,'energia_nucleare'), null);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /information_schema\.columns/);
  assert.doesNotMatch(pool.calls[0].sql, /opinioni_domande/);
});

test('SQL injection and invalid column identifiers are refused before a query', async () => {
  const pool = createPool(true);
  for (const invalid of ['x";DROP TABLE users;--', 'x y', 'X', '', '../users', 'a'.repeat(65), null]) {
    assert.equal(await resolvePublishedOpinionColumn(pool, invalid), null);
  }
  assert.equal(pool.calls.length, 0);
});
