'use strict';

// Pure, synthetic regression tests for the EXISTING DEMOS political-matching
// engine. Codec prototypes must reconstruct exactly the same per-opinion maps;
// the matching engine, API and actual database remain entirely unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const { getOpinionCompletion, calculatePoliticalMatch } =
  require('../utils/politicalMatching');
const { encodeAnswers, decodeAnswers } = require('../utils/opinionBitset');
const { encodeTrimmed, decodeTrimmed } = require('../utils/opinionTrimmedBitset');
const { encodeSparse, decodeSparse } = require('../utils/opinionSparseBitset');

const IDS = Array.from({ length: 94 }, (_, i) => 'q' + i);
const RESTORE = Object.freeze({
  fixed: (map) => decodeAnswers(IDS, encodeAnswers(IDS, map)),
  trimmed: (map) => decodeTrimmed(IDS, encodeTrimmed(IDS, map)),
  sparse: (map) => decodeSparse(IDS, encodeSparse(IDS, map))
});
const EXPECTED = Object.keys(RESTORE);

function comparable(map) {
  return Object.fromEntries(IDS.map(id => [id, map[id] ?? null]));
}
function exercise(user, target, subset) {
  const normalizedUser = comparable(user);
  const normalizedTarget = comparable(target);
  const expectedCompletion = getOpinionCompletion(subset, normalizedUser);
  const expectedMatch = calculatePoliticalMatch(subset, normalizedUser, normalizedTarget);
  for (const coding of EXPECTED) {
    const restoredUser = RESTORE[coding](user);
    const restoredTarget = RESTORE[coding](target);
    assert.deepEqual(restoredUser, normalizedUser, coding + ': user map changed');
    assert.deepEqual(restoredTarget, normalizedTarget, coding + ': target map changed');
    assert.deepEqual(getOpinionCompletion(subset, restoredUser), expectedCompletion,
      coding + ': completion changed');
    assert.deepEqual(calculatePoliticalMatch(subset, restoredUser, restoredTarget),
      expectedMatch, coding + ': political match changed');
  }
  return { expectedCompletion, expectedMatch };
}

test('all missing, all complete and partially complete user remain identical', () => {
  const grade = IDS.slice(0, 17);
  const empty = exercise({}, {}, grade);
  assert.equal(empty.expectedCompletion.isComplete, false);
  assert.equal(empty.expectedCompletion.answeredOpinions, 0);
  const completeUser = Object.fromEntries(IDS.map((id, index) =>
    [id, ['f', 'c', 'i'][index % 3]]));
  const complete = exercise(completeUser, {}, grade);
  assert.equal(complete.expectedCompletion.isComplete, true);
  assert.equal(complete.expectedMatch.targetMissing, grade.length);
  const partial = exercise({q0:'i', q1:'c', q93:'f'}, {q0:'i', q1:'f'}, grade);
  assert.equal(partial.expectedCompletion.answeredOpinions, 2);
});

test('known scoring semantics for agreement, disagreement, uncertainty and missing target', () => {
  const user = {q0:'f', q1:'f', q2:'c', q3:'i', q4:'i'};
  const target = {q0:'f', q1:'c', q2:'c', q3:'i', q4:'f'};
  const { expectedMatch } = exercise(user, target, IDS.slice(0,6));
  assert.equal(expectedMatch.clearAgreements, 2);
  assert.equal(expectedMatch.disagreements, 1);
  assert.equal(expectedMatch.uncertainAgreements, 1);
  assert.equal(expectedMatch.mixedUncertainty, 1);
  assert.equal(expectedMatch.targetMissing, 1);
  assert.equal(expectedMatch.rawScore, 6);
});

test('score and completion stable for all 94 opinion IDs over sparse and dense samples', () => {
  let seed = 0x789345ab;
  const rand = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const shuffledGrades = [
    IDS, IDS.slice(0,5), IDS.filter((_,i) => i % 3 === 0),
    IDS.slice(49), IDS.slice(90)
  ];
  for (const density of [0,0.01,0.09,0.4,1]) {
    for (let iteration = 0; iteration < 70; iteration++) {
      const user = {}, target = {};
      for (const id of IDS) {
        if (rand() < density) user[id] = ['f','c','i'][Math.floor(rand()*3)];
        if (rand() < density) target[id] = ['f','c','i'][Math.floor(rand()*3)];
      }
      exercise(user, target, shuffledGrades[iteration % shuffledGrades.length]);
    }
  }
});

test('append-only future opinion IDs keep older grade matching unchanged', () => {
  const ids = IDS.slice(0,12);
  const user = {q0:'f',q5:'i',q11:'c'};
  const target = {q0:'c',q5:'i',q11:'c'};
  const expected = calculatePoliticalMatch(ids, user, target);
  exercise(user, target, ids);
  const future = [...IDS, 'new_opinion'];
  const packed = encodeSparse(IDS, user);
  assert.equal(decodeSparse(future, packed).q11, 'c');
  assert.equal(decodeSparse(future, packed).new_opinion, null);
  assert.deepEqual(calculatePoliticalMatch(ids,
    decodeSparse(future, packed), target), expected);
});
