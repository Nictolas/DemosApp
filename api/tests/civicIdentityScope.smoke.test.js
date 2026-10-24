'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('political-consent writes retain central server-side civic identity gate', () => {
  for (const rel of [
    'api/routes/amnistia.js','api/routes/capo-stato.js','api/routes/governo.js',
    'api/routes/grazia.js','api/routes/iniziative-popolari.js',
    'api/routes/opinioni-proposte.js','api/routes/referendum.js',
  ]) {
    const source = read(rel);
    assert.match(source, /requireVerifiedCivicIdentity/);
    assert.doesNotMatch(source, /verifyToken,\s*requirePoliticalConsent/);
  }
});

test('canonical political selections retain the configurable civic identity gate', () => {
  assert.match(read('api/routes/opinioni/user-answers.js'), /router\.post\('\/salva',\s*verifyToken,\s*requireVerifiedCivicIdentity/);
  assert.match(read('api/routes/candidati.js'), /router\.put\('\/seleziona-candidato',\s*verifyToken,\s*requireVerifiedCivicIdentity/);
  assert.match(read('api/routes/users/profile.js'), /router\.put\('\/:userId\/political-selection',\s*verifyToken,\s*requireVerifiedCivicIdentity/);
  assert.match(read('api/routes/rappresentanti.js'), /router\.post\('\/',\s*verifyToken,\s*requireVerifiedCivicIdentity/);
});

test('voluntary preference removal remains outside the new CIE gate', () => {
  assert.match(read('api/routes/amnistia.js'), /router\.delete\('\/vota',\s*verifyToken,/);
  assert.match(read('api/routes/referendum.js'), /router\.delete\('\/abrogativi\/vota',\s*verifyToken,/);
  assert.match(read('api/routes/opinioni-proposte.js'), /router\.delete\('\/:id\/vota',\s*verifyToken,/);
});