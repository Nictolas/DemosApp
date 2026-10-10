const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('proposal vote schema is migration-owned, not created by the runtime route', () => {
  const route = read('api/routes/opinioni-proposte.js');
  const migration = read('api/database/create-voti-opinioni-proposte-table.sql');
  assert.doesNotMatch(route, /CREATE TABLE IF NOT EXISTS voti_opinioni_proposte/);
  assert.doesNotMatch(route, /ensureVotiTableExists/);
  assert.doesNotMatch(route, /Tabella voti_opinioni_proposte verificata\/creata/);
  assert.match(route, /to_regclass\('public\.voti_opinioni_proposte'\)/);
  assert.match(route, /VOTI_OPINIONI_PROPOSTE_SCHEMA_MISSING/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS voti_opinioni_proposte/);
  assert.match(migration, /UNIQUE \(utente_id, opinione_id\)/);
});

test('Admin test-voto endpoint is diagnostic-only and performs no write', () => {
  const route = read('api/routes/opinioni-proposte.js');
  const start = route.indexOf("router.get('/test-voto'");
  const end = route.indexOf('// GET /api/opinioni-proposte/debug', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = route.slice(start, end);
  assert.match(block, /verifyToken, requireAdmin/);
  assert.match(block, /SELECT COUNT\(\*\)::int AS voti_count/);
  assert.doesNotMatch(block, /INSERT|UPDATE|DELETE/i);
});
