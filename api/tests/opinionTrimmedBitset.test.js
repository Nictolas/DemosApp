'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  trimTrailingZeroBytes, expandTrimmed, encodeTrimmed,
  decodeTrimmed, readTrimmed, patchTrimmed
} = require('../utils/opinionTrimmedBitset');
const { encodeAnswers, decodeAnswers } = require('../utils/opinionBitset');

test('all NULL/unanswered uses zero bytes and round trips without becoming indeciso', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  const compact = encodeTrimmed(ids, {});
  assert.equal(compact.length, 0);
  assert.equal(readTrimmed(ids, compact, 'q93'), null);
  assert.deepEqual(decodeTrimmed(ids, compact),
    Object.fromEntries(ids.map(id => [id, null])));
});

test('trailing zero bytes may be removed but internal unanswered positions remain intact', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  const packed = encodeTrimmed(ids, { q0: 'f', q12: 'i' });
  assert.equal(packed.length, 4);
  assert.deepEqual([...packed], [0b01000000, 0, 0, 0b11000000]);
  assert.equal(readTrimmed(ids, packed, 'q1'), null);
  assert.equal(readTrimmed(ids, packed, 'q12'), 'i');
  assert.equal(readTrimmed(ids, packed, 'q93'), null);
  assert.equal(expandTrimmed(ids, packed).length, 24);
});

test('answer in final slot still needs full 24-byte representation', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  const compact = encodeTrimmed(ids, { q93: 'c' });
  assert.equal(compact.length, 24);
  assert.equal(compact[23], 0b00100000);
  assert.equal(readTrimmed(ids, compact, 'q93'), 'c');
});

test('patch changes only requested opinions and re-trims after clearing the last answer', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const initial = encodeTrimmed(ids, { a: 'c', i: 'i' });
  assert.equal(initial.length, 3);
  const snapshot = Buffer.from(initial);
  const next = patchTrimmed(ids, initial, { i: null, b: 'f' });
  assert.equal(next.length, 1);
  assert.deepEqual(decodeTrimmed(ids, next), {
    a: 'c', b: 'f', c: null, d: null, e: null, f: null,
    g: null, h: null, i: null
  });
  assert.deepEqual(initial, snapshot);
});

test('compact format is exactly equivalent to fixed format when expanded', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  let seed = 123456789;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (const probability of [0, 0.01, 0.08, 0.4, 1]) {
    for (let sample = 0; sample < 70; sample += 1) {
      const answers = {};
      for (const id of ids) {
        if (random() < probability) {
          answers[id] = ['f', 'c', 'i'][Math.floor(random() * 3)];
        }
      }
      const fixed = encodeAnswers(ids, answers);
      const compact = encodeTrimmed(ids, answers);
      assert.deepEqual(expandTrimmed(ids, compact), fixed);
      assert.deepEqual(decodeTrimmed(ids, compact), decodeAnswers(ids, fixed));
      assert.ok(compact.length <= 24);
      assert.ok(compact.length === 0 || compact[compact.length - 1] !== 0);
    }
  }
});

test('catalog append-only extension does not expand old compact payload', () => {
  const v1 = ['energia_nucleare', 'caccia', 'ius_soli'];
  const compact = encodeTrimmed(v1, { caccia: 'f' });
  const v2 = [...v1, 'salario_minimo', 'citta_30'];
  assert.equal(expandTrimmed(v2, compact).length, 2);
  assert.equal(readTrimmed(v2, compact, 'caccia'), 'f');
  assert.equal(readTrimmed(v2, compact, 'citta_30'), null);
});

test('malformed payloads, trailing zeros, unknown IDs and padding are rejected', () => {
  const ids = ['a', 'b', 'c'];
  assert.throws(() => expandTrimmed(ids, '01'), TypeError);
  assert.throws(() => expandTrimmed(ids, Buffer.from([0, 1])), RangeError);
  assert.throws(() => expandTrimmed(ids, Buffer.from([0])), RangeError);
  assert.throws(() => expandTrimmed(ids, Buffer.from([0b00000001])), RangeError);
  assert.throws(() => decodeTrimmed(ids, Buffer.from([0b00000010])), RangeError);
  assert.throws(() => readTrimmed(ids, Buffer.alloc(0), 'z'), RangeError);
  assert.throws(() => patchTrimmed(ids, Buffer.alloc(0), { z: 'f' }), RangeError);
  assert.throws(() => trimTrailingZeroBytes('01'), TypeError);
});
