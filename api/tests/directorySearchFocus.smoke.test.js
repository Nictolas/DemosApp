'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

for (const [name, relative] of [
  ['Attivisti', 'client/src/pages/Attivisti.tsx'],
  ['Organizzazioni', 'client/src/pages/Organizzazioni/index.tsx']
]) {
  test(name + ': search input stays mounted while loading, error or zero results', () => {
    const src = fs.readFileSync(path.join(root, relative), 'utf8');
    const searchStart = src.indexOf('{/* Barra di Ricerca e Filtri: resta montata');
    const searchEnd = src.indexOf('{/* Intestazione e controlli rimangono fissi;', searchStart);
    assert.ok(searchStart > 0 && searchEnd > searchStart, 'stable search area required');
    const search = src.slice(searchStart, searchEnd);
    assert.match(search, /<Input\s+type="text"/);
    assert.match(search, /value=\{searchTerm\}/);
    assert.match(search, /onChange=\{handleSearchChange\}/);
    assert.doesNotMatch(search, /\{!isLoading && !isError/);
    assert.doesNotMatch(search, /\{!isLoading && !isError && [a-zA-Z]+\.length/);
    assert.match(src, /\{isLoading && \(/, 'spinner remains in scrollable list');
    assert.match(src, /\{isError && \(/, 'error state remains visible in scrollable list');
  });

  test(name + ': backend search debounced and stale requests aborted on next character', () => {
    const src = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(src, /const controller = new AbortController\(\)/);
    assert.match(src, /fetch\(url, \{ signal: controller\.signal(?:, cache: 'no-store')? \}\)/);
    assert.match(src, /if \(controller\.signal\.aborted\) return;/);
    assert.match(src, /window\.setTimeout\(\(\) => \{/);
    assert.match(src, /searchTerm\.trim\(\) \? 300 : 0/);
    assert.match(src, /window\.clearTimeout\(timer\)/);
    assert.match(src, /controller\.abort\(\)/);
    assert.match(src, /\[searchTerm, selectedRegione, selectedTipologia\]/);
  });
}
