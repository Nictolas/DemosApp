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

test('opinion statistics use canonical PERSON account population in every aggregate', () => {
  const stats = read('api/routes/opinioni/stats.js');
  assert.equal(countMatches(stats, /AND u\.account_type = 'PERSON'/g), 6);
  assert.doesNotMatch(stats, /u\.ruolo NOT IN \('I', 'O', 'Istituzione', 'Organizzazione'\)/);
});

test('survey opinion aggregates use the canonical PERSON population across national and territorial queries', () => {
  const surveys = read('api/routes/sondaggi.js');
  const national = read('api/utils/sondaggiTextBulk.js');
  assert.equal(countMatches(surveys, /AND u\.account_type = 'PERSON'/g), 3);
  assert.equal(countMatches(national, /AND u\.account_type = 'PERSON'/g), 2);
  assert.doesNotMatch(surveys + national,
    /u\.ruolo NOT IN \('I', 'O', 'Istituzione', 'Organizzazione'\)/);
});

test('opinion statistics continue to require an explicit answer and political-opinion consent', () => {
  const stats = read('api/routes/opinioni/stats.js');
  assert.equal(countMatches(stats, /WHERE orr\.\$\{columnName\} IS NOT NULL/g), 6);
  assert.equal(
    countMatches(stats, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/g),
    6
  );
});

test('survey aggregates exclude NULL answers and require consent in grouped and fallback TEXT', () => {
  const surveys = read('api/routes/sondaggi.js');
  const national = read('api/utils/sondaggiTextBulk.js');
  assert.equal(countMatches(surveys, /orr\."\$\{columnName\}" IS NOT NULL/g), 3);
  assert.equal(
    countMatches(surveys, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/g),
    3
  );
  assert.match(national, /v\.answer IS NOT NULL/);
  assert.match(national, /WHERE orr\.\$\{quoted\} IS NOT NULL/);
  assert.equal(countMatches(national, /COALESCE\(uc\.political_opinions_consent,/g), 2);
});
