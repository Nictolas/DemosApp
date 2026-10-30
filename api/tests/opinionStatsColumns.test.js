const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePublishedOpinionColumn } = require('../utils/opinionStatsColumns');
const { getAllOpinions } = require('../services/opinionCatalog');

function forbiddenDatabasePool() {
  return {
    async query() {
      throw new Error('Statistics column resolution must never query schema metadata');
    }
  };
}

test('all official opinion identifiers resolve without ANY SQL schema lookup', async () => {
  const pool = forbiddenDatabasePool();
  const published = getAllOpinions();
  assert.equal(published.length, 94);
  for (const opinion of published) {
    assert.equal(await resolvePublishedOpinionColumn(pool, opinion.id), opinion.id);
  }
});

test('unknown or invalid opinion IDs are refused before SQL interpolation', async () => {
  const pool = forbiddenDatabasePool();
  for (const invalid of [
    'inesistente', 'x";DROP TABLE users;--', 'x y', 'X', '',
    '../users', 'a'.repeat(65), null, undefined, 12, {},
    'fonti_opinioni', 'user_id'
  ]) {
    assert.equal(await resolvePublishedOpinionColumn(pool, invalid), null);
  }
});

test('no hard-coded mapping required for official newer questions', async () => {
  const pool = forbiddenDatabasePool();
  assert.equal(await resolvePublishedOpinionColumn(pool, 'citta_30'), 'citta_30');
  assert.equal(await resolvePublishedOpinionColumn(pool, 'auto_emissioni_zero_2035'), 'auto_emissioni_zero_2035');
});

test('opinion statistics never return raw SQL errors or log exception objects', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/opinioni/stats.js'), 'utf8');
  assert.doesNotMatch(source, /message:\s*error\.message|error:\s*error\.message/);
  assert.doesNotMatch(source, /console\.error\([^;\n]*,\s*error(?:\.stack)?\s*\)/);
  assert.doesNotMatch(source, /Error details:/);
  assert.match(source, /message:\s*'Errore interno del server'/);
});
