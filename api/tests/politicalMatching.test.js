const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeOpinionAnswer,
  getOpinionCompletion,
  scoreOpinionPair,
  calculatePoliticalMatch
} = require('../utils/politicalMatching');

test('normalizza le tre risposte DEMOS e non tratta NULL come risposta', () => {
  assert.equal(normalizeOpinionAnswer('f'), 'f');
  assert.equal(normalizeOpinionAnswer('Favorevole'), 'f');
  assert.equal(normalizeOpinionAnswer('c'), 'c');
  assert.equal(normalizeOpinionAnswer('Contrario'), 'c');
  assert.equal(normalizeOpinionAnswer('i'), 'i');
  assert.equal(normalizeOpinionAnswer('Non lo so'), 'i');
  assert.equal(normalizeOpinionAnswer(null), null);
  assert.equal(normalizeOpinionAnswer(''), null);
});

test('matrice approvata: +3 accordo chiaro, +1 non lo so comune, 0 misto, -1 divergenza', () => {
  assert.deepEqual(scoreOpinionPair('f', 'f'), { points: 3, kind: 'clear_agreement' });
  assert.deepEqual(scoreOpinionPair('c', 'c'), { points: 3, kind: 'clear_agreement' });
  assert.deepEqual(scoreOpinionPair('i', 'i'), { points: 1, kind: 'uncertain_agreement' });
  assert.deepEqual(scoreOpinionPair('f', 'i'), { points: 0, kind: 'mixed_uncertainty' });
  assert.deepEqual(scoreOpinionPair('i', 'c'), { points: 0, kind: 'mixed_uncertainty' });
  assert.deepEqual(scoreOpinionPair('f', 'c'), { points: -1, kind: 'disagreement' });
  assert.deepEqual(scoreOpinionPair('c', 'f'), { points: -1, kind: 'disagreement' });
  assert.deepEqual(scoreOpinionPair('f', null), { points: 0, kind: 'target_missing' });
});

test('gate utente: tutte le Opinioni devono avere f/c/i e Non lo so conta come completata', () => {
  const ids = ['o1', 'o2', 'o3'];
  const complete = getOpinionCompletion(ids, { o1: 'f', o2: 'i', o3: 'c' });
  assert.equal(complete.isComplete, true);
  assert.equal(complete.answeredOpinions, 3);
  assert.equal(complete.missingOpinions, 0);
  assert.equal(complete.completionPercentage, 100);

  const incomplete = getOpinionCompletion(ids, { o1: 'f', o2: null, o3: 'c' });
  assert.equal(incomplete.isComplete, false);
  assert.deepEqual(incomplete.missingOpinionIds, ['o2']);
});

test('percentuale: 10 accordi chiari su 10 = 100%', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `o${i + 1}`);
  const user = Object.fromEntries(ids.map((id) => [id, 'f']));
  const target = Object.fromEntries(ids.map((id) => [id, 'f']));
  const result = calculatePoliticalMatch(ids, user, target);

  assert.equal(result.rawScore, 30);
  assert.equal(result.compatibilityPercentage, 100);
  assert.equal(result.knownPositions, 10);
});

test('percentuale: 5 accordi chiari + 5 divergenze = 33,3%', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `o${i + 1}`);
  const user = Object.fromEntries(ids.map((id) => [id, 'f']));
  const target = Object.fromEntries(ids.map((id, index) => [id, index < 5 ? 'f' : 'c']));
  const result = calculatePoliticalMatch(ids, user, target);

  assert.equal(result.rawScore, 10);
  assert.equal(result.compatibilityPercentage, 33.3);
  assert.equal(result.clearAgreements, 5);
  assert.equal(result.disagreements, 5);
});

test('percentuale: 5 accordi chiari + 5 NULL = 50% e copertura 50%', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `o${i + 1}`);
  const user = Object.fromEntries(ids.map((id) => [id, 'f']));
  const target = Object.fromEntries(ids.map((id, index) => [id, index < 5 ? 'f' : null]));
  const result = calculatePoliticalMatch(ids, user, target);

  assert.equal(result.rawScore, 15);
  assert.equal(result.compatibilityPercentage, 50);
  assert.equal(result.knownPositions, 5);
  assert.equal(result.coveragePercentage, 50);
});

test('percentuale: 10 Non lo so in comune = 33,3%', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `o${i + 1}`);
  const user = Object.fromEntries(ids.map((id) => [id, 'i']));
  const target = Object.fromEntries(ids.map((id) => [id, 'i']));
  const result = calculatePoliticalMatch(ids, user, target);

  assert.equal(result.rawScore, 10);
  assert.equal(result.compatibilityPercentage, 33.3);
  assert.equal(result.uncertainAgreements, 10);
});

test('percentuale negativa viene mostrata come 0 ma il punteggio grezzo resta negativo per il ranking', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `o${i + 1}`);
  const user = Object.fromEntries(ids.map((id) => [id, 'f']));
  const target = Object.fromEntries(ids.map((id) => [id, 'c']));
  const result = calculatePoliticalMatch(ids, user, target);

  assert.equal(result.rawScore, -10);
  assert.equal(result.compatibilityPercentage, 0);
});

test('esempio approvato: 7 accordi + 1 Non lo so comune + 2 divergenze = 66,7%', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `o${i + 1}`);
  const user = {
    o1: 'f', o2: 'f', o3: 'f', o4: 'f', o5: 'f', o6: 'f', o7: 'f',
    o8: 'i', o9: 'f', o10: 'c'
  };
  const target = {
    o1: 'f', o2: 'f', o3: 'f', o4: 'f', o5: 'f', o6: 'f', o7: 'f',
    o8: 'i', o9: 'c', o10: 'f'
  };
  const result = calculatePoliticalMatch(ids, user, target);

  assert.equal(result.rawScore, 20);
  assert.equal(result.compatibilityPercentage, 66.7);
});
