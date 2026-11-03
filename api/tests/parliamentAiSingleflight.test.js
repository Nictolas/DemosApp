'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSingleflight } = require('../services/parliamentAiSingleflight');
const fs = require('node:fs');
const path = require('node:path');

test('same parliamentary vote shares exactly one in-flight Promise', async () => {
  const once = createSingleflight();
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const task = async () => { calls++; await gate; return { explanation: 'Documented result' }; };
  const first = once('S. 100', task);
  const second = once(' S. 100 ', task);
  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { explanation: 'Documented result' });
  assert.deepEqual(await second, { explanation: 'Documented result' });
  assert.deepEqual(await once('S. 100', task), { explanation: 'Documented result' });
  assert.equal(calls, 2);
});

test('different votes are not incorrectly merged', async () => {
  const once = createSingleflight();
  const a = await Promise.all([
    once('vote 1', async () => 'a'),
    once('vote 2', async () => 'b')
  ]);
  assert.deepEqual(a, ['a', 'b']);
});

test('failure does not permanently block a vote', async () => {
  const once = createSingleflight();
  let calls = 0;
  await assert.rejects(() => once('vote 10', async () => { calls++; throw new Error('unavailable'); }), /unavailable/);
  assert.equal(await once('vote 10', async () => { calls++; return 'recovered'; }), 'recovered');
  assert.equal(calls, 2);
});

test('null results are not cached permanently', async () => {
  const once = createSingleflight();
  assert.equal(await once('vote 20', async () => null), null);
  assert.equal(await once('vote 20', async () => 'later'), 'later');
});

test('both services deduplicate in-flight calls per voting identifier', () => {
  const law = fs.readFileSync(path.join(__dirname, '../services/leggeAnalysisService.js'), 'utf8');
  const summary = fs.readFileSync(path.join(__dirname, '../services/aiExplanationService.js'), 'utf8');
  assert.match(law, /singleflightAnalisi\(uriVotazione, \(\) => generaAnalisiLeggeUnaVolta\(/);
  assert.match(summary, /singleflightSpiegazione\(votazioneId, \(\) =>/);
});

test('European Parliament analysis calls respect URI-first object-second signature', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/voti-parlamento-europeo.js'), 'utf8');
  assert.doesNotMatch(source, /generaAnalisiLegge\(votazione\.titolo,\s*decodedUri\)/);
  assert.equal((source.match(/generaAnalisiLegge\(decodedUri, \{/g) || []).length, 2);
  assert.match(source, /if \(!analisiLegge\)\s*\{\s*\/\/ Il testo ufficiale resta/);
});
