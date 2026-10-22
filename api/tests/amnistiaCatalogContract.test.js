const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'amnistia.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', '..', '20261022_amnistia_catalogo_reati.sql'), 'utf8');
test('Amnistia classifica excludes inactive offenses and keeps historical votes removable', () => {
  assert.match(route, /FROM amnistia WHERE attiva = true ORDER BY legge/);
  assert.match(route, /SELECT id FROM amnistia WHERE legge = \\$1 AND attiva = true/);
  assert.match(route, /DELETE FROM voti_amnistia WHERE userid = \\$1 AND legge = \\$2/);
  assert.doesNotMatch(migration, /DELETE FROM public\\.voti_amnistia/i);
});
test('Amnistia historic catalog includes ten offenses without votes', () => {
  assert.equal((migration.match(/\\(non vigente\\)/g) || []).length, 7);
  assert.match(migration, /Ricettazione di particolare tenuità/);
  assert.match(migration, /Blocco stradale durante manifestazioni sindacali/);
  assert.doesNotMatch(migration, /INSERT INTO public\\.voti_amnistia/i);
});
