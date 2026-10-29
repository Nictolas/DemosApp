'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

test('opinion statistics include long and compact PERSON account population in every aggregate', () => {
  const stats = read('api/routes/opinioni/stats.js');
  assert.equal(countMatches(stats, /AND u\.account_type IN \('PERSON', 'P'\)/g), 6);
  assert.doesNotMatch(stats, /u\.ruolo NOT IN \('I', 'O', 'Istituzione', 'Organizzazione'\)/);
});

test('survey opinion aggregates include the same dual-format PERSON population', () => {
  const surveys = read('api/routes/sondaggi.js');
  assert.equal(countMatches(surveys, /AND u\.account_type IN \('PERSON', 'P'\)/g), 4);
  assert.doesNotMatch(surveys, /u\.ruolo NOT IN \('I', 'O', 'Istituzione', 'Organizzazione'\)/);
});

test('opinion statistics continue to require an explicit answer and political-opinion consent', () => {
  const stats = read('api/routes/opinioni/stats.js');
  assert.equal(countMatches(stats, /WHERE orr\.\$\{columnName\} IS NOT NULL/g), 6);
  assert.equal(
    countMatches(stats, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/g),
    6
  );
});

test('survey aggregates continue to exclude NULL answers and require consent', () => {
  const surveys = read('api/routes/sondaggi.js');
  assert.equal(countMatches(surveys, /orr\."\$\{columnName\}" IS NOT NULL/g), 4);
  assert.equal(
    countMatches(surveys, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/g),
    4
  );
});
