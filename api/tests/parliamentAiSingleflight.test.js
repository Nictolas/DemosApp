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

test('a reused vote id with a different title must not share a stale in-flight explanation', async () => {
  const once = createSingleflight();
  let releaseOld;
  let oldCalls = 0;
  const pendingOld = new Promise(resolve => { releaseOld = resolve; });
  const oldKey = JSON.stringify([523, 'Votazione finale A']);
  const newKey = JSON.stringify([523, 'Votazione finale B']);

  const old = once(oldKey, async () => {
    oldCalls++;
    await pendingOld;
    return 'Testo relativo alla vecchia votazione';
  });
  const sameOld = once(oldKey, async () => 'Non deve partire una seconda chiamata');
  assert.strictEqual(old, sameOld, 'Identical vote id and title must share work');

  const current = once(newKey, async () => 'Testo relativo alla nuova votazione');
  assert.equal(await current, 'Testo relativo alla nuova votazione',
    'A changed vote title must not reuse the previous pending explanation');
  releaseOld();
  assert.equal(await old, 'Testo relativo alla vecchia votazione');
  assert.equal(oldCalls, 1);
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
  assert.match(summary, /const voteIdentity = JSON\.stringify\(\[votazioneId, titoloVotazione\]\)/);
  assert.match(summary, /singleflightSpiegazione\(voteIdentity, \(\) =>/);
});

test('European Parliament analysis calls respect URI-first object-second signature', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/voti-parlamento-europeo.js'), 'utf8');
  assert.doesNotMatch(source, /generaAnalisiLegge\(votazione\.titolo,\s*decodedUri\)/);
  assert.equal((source.match(/generaAnalisiLegge\(decodedUri, \{/g) || []).length, 2);
  assert.match(source, /if \(!analisiLegge\)\s*\{\s*\/\/ Il testo ufficiale resta/);
});
