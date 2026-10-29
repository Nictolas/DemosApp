'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/Utenti/index.tsx'), 'utf8');

test('le statistiche eta non contengono nessun fallback con numeri di esempio', () => {
  assert.doesNotMatch(source, /finalUsersByAge/);
  assert.doesNotMatch(source, /crea dati di esempio/i);
  assert.doesNotMatch(source, /'18-25':\s*15|\'26-35\':\s*25|\'36-45\':\s*20/);
});

test('le statistiche eta contano soltanto PERSON con date ISO valide e nessuna supposizione', () => {
  assert.match(source, /if \(user\.account_type !== 'PERSON' && user\.account_type !== 'P'\) return acc/);
  assert.match(source, /typeof user\.data_nascita === 'string'/);
  assert.match(source, /const match = \/\^\(\\d\{4\}\)-\(\\d\{2\}\)-\(\\d\{2\}\)\$\//);
  assert.match(source, /getUTCFullYear\(\) === year/);
  assert.match(source, /getUTCMonth\(\) === month - 1/);
  assert.match(source, /getUTCDate\(\) === day/);
  assert.match(source, /age >= 0 && age <= 125/);
  assert.match(source, /let ageGroup = 'N\/A'/);
  assert.match(source, /acc\[ageGroup\] = \(acc\[ageGroup\] \|\| 0\) \+ 1/);
  assert.match(source, /usersByAge\s*\n\s*};/);
  assert.doesNotMatch(source, /birth_date \|\| user\.date_of_birth/);
});

test('le schermate esplicitano le fonti e non chiamano certificate le date importate', () => {
  assert.match(source, /non necessariamente certificate/);
  assert.match(source, /profili politici importati/);
  assert.match(source, /date mancanti, impossibili o implausibili/i);
});
