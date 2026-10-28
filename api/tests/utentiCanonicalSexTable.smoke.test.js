'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root,relative),'utf8');

test('admin desktop table shows saved M/F sex, never legacy Genere', () => {
  const constants=read('client/src/pages/Utenti/constants/index.ts');
  const table=read('client/src/pages/Utenti/components/UsersTable.tsx');
  const renderer=read('client/src/pages/Utenti/utils/renderUtils.tsx');
  const formatter=read('client/src/pages/Utenti/utils/columnUtils.ts');

  assert.match(constants, /'genere', 'account_type'/);
  assert.match(constants, /'grado_candidatura', 'grado_elezione', 'sesso'/);
  assert.match(constants, /'data_nascita', 'sesso', 'paese_residenza'/);
  assert.match(table, /column === 'sesso' \? 'Sesso'/);
  assert.match(renderer, /columnName === 'sesso'/);
  assert.match(renderer, /Non disponibile/);
  assert.match(renderer, /Non applicabile/);
  assert.match(renderer, /'Maschile' : 'Femminile'/);
  assert.doesNotMatch(renderer, /columnName === 'genere'/);
  assert.match(formatter, /columnName === 'sesso'/);
  assert.match(formatter, /'Non disponibile'/);
  assert.doesNotMatch(formatter, /if \(columnName === 'genere'\)/);
});

test('admin statistics count only PERSON and M/F with NULL as not available', () => {
  const source=read('client/src/pages/Utenti/index.tsx');
  assert.match(source, /const usersBySesso = utenti.reduce/);
  assert.match(source, /user.account_type !== 'PERSON'/);
  assert.match(source, /user.sesso === 'M' \|\| user.sesso === 'F'/);
  assert.match(source, /'Non disponibile'/);
  assert.match(source, /stats.usersBySesso/);
  assert.match(source, /Distribuzione per sesso/);
  assert.doesNotMatch(source, /usersByGender|Distribuzione per Genere|user\.genere/);
});

test('GET /api/users and GET /api/users/:userId expose canonical sex alongside account_type', () => {
  const source=read('api/routes/users/search.js');
  const list=source.slice(source.indexOf("// GET /api/users/ - "),source.indexOf("// GET /api/users/:userId"));
  const get=source.slice(source.indexOf("// GET /api/users/:userId"),source.indexOf("// PUT /api/users/:userId"));
  assert.match(source,/avatar_config, sesso, account_type, genere, cittadinanza/);
  assert.match(source,/sesso, account_type, genere, data_nascita/);
  assert.match(list, /sesso: \['M', 'F'\]\.includes\(user\.sesso\) \? user\.sesso : null/);
  assert.match(get, /sesso: \['M', 'F'\]\.includes\(user\.sesso\) \? user\.sesso : null/);
  assert.match(source,/sesso: \['M', 'F'\]\.includes\(updatedUser\.sesso\)/);
});

test('neither the admin nor self-service endpoint may write sesso or genere', () => {
  for(const relative of ['api/routes/users/search.js','api/routes/users/profile.js']) {
    const source=read(relative);
    const editable=source.slice(source.indexOf("const allowedFields = ["));
    const fields=editable.match(/const allowedFields = \[([\s\S]*?)\];/);
    assert.ok(fields,relative);
    assert.doesNotMatch(fields[1],/'genere'|'sesso'/);
  }
  const profile=read('client/src/components/profile/PersonalDataSection.tsx');
  assert.doesNotMatch(profile,/onFieldChange\("genere"/);
  assert.doesNotMatch(profile,/onFieldChange\("sesso"/);
  assert.doesNotMatch(profile,/Label htmlFor="genere"|Seleziona il genere|showGenereForRole/);
});
