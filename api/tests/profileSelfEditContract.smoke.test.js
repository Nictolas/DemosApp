'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('own profile editor is identical for admin and electors', () => {
  const page = read('client/src/pages/Profilo/index.tsx');
  const editor = read('client/src/components/profile/EditProfileForm.tsx');
  const fields = read('client/src/components/profile/PersonalDataSection.tsx');

  assert.match(page, /<EditProfileForm/);
  assert.doesNotMatch(editor, /\bisAdmin\b|shouldShowElectionSection|shouldShowCandidacySection/);
  assert.doesNotMatch(editor, /title="Elezione"|title="Candidatura"|prefix="elezione"|prefix="candidatura"/);
  assert.doesNotMatch(fields, /htmlFor="ruolo"|onFieldChange\("ruolo"/);
  assert.match(fields, /Anno di nascita/);
  assert.match(fields, /onFieldChange\("data_nascita"/);
  assert.match(fields, /onFieldChange\("genere"/);
  assert.match(editor, /title="Residenza"/);
});

test('self-edit submits only personal fields and correctly parses API responses', () => {
  const hook = read('client/src/components/profile/useProfileForm.ts');
  assert.match(hook, /const editableSelfFields = new Set\(/);
  for (const field of ['data_nascita', 'genere', 'cittadinanza', 'comune_residenza']) {
    assert.match(hook, new RegExp('"' + field + '"'));
  }
  assert.match(hook, /if \(!editableSelfFields\.has\(key\)\) return;/);
  assert.match(hook, /apiRequest\("PUT", "\/api\/users\/me", dataToSend\)/);
  assert.match(hook, /response\.data \?\? await response\.json\(\)/);
  assert.doesNotMatch(hook, /api\/users\/\$\{userData\.uid\}|\/api\/attivismo-tipologie/);
});

test('profile endpoint forbids roles and political office edits but retains social URLs', () => {
  const api = read('api/routes/users/profile.js');
  const start = api.indexOf("router.put('/me'");
  const end = api.indexOf("router.put('/:userId/seleziona-rappresentante'", start);
  assert.ok(start >= 0 && end > start);
  const personal = api.slice(start, end);
  const fields = personal.match(/const allowedFields = \[([\s\S]*?)\];/);
  assert.ok(fields);
  for (const field of ['ruolo', 'sesso', 'grado_elezione', 'grado_candidatura', 'nome', 'cognome']) {
    assert.doesNotMatch(fields[1], new RegExp("'" + field + "'"));
    assert.match(personal, new RegExp("'" + field + "'"));
  }
  for (const field of ['genere', 'data_nascita', 'comune_residenza', 'website_url']) {
    assert.match(fields[1], new RegExp("'" + field + "'"));
  }
  assert.match(personal, /const encodedGender = compressGender\(value\)/);
  assert.match(personal, /\$\{year\}-01-01/);
  assert.match(personal, /decompressGender\(updatedUser\.genere\)/);
  assert.match(personal, /decompressUserLocation\(updatedUser\)/);
});

test('changing residence parent selections clears dependent location fields', () => {
  const geo = read('client/src/components/profile/GeographicSection.tsx');
  assert.match(geo, /onFieldChange\(`regione_\$\{prefix\}`, ""\)/);
  assert.match(geo, /onFieldChange\(`provincia_\$\{prefix\}`, ""\)/);
  assert.match(geo, /onFieldChange\(`comune_\$\{prefix\}`, ""\)/);
});
