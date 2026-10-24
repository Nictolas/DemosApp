'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { encodeSparse, decodeSparse, patchSparse } = require('../utils/opinionSparseBitset');

test('no answers occupy zero bytes, and NULL is separate from indeciso', () => {
  const ids = ['nato', 'caccia', 'ius_soli'];
  assert.equal(encodeSparse(ids, {}).length, 0);
  const buf = encodeSparse(ids, { nato: null, caccia: 'i' });
  assert.deepEqual([...buf], [0b00001011]);
  assert.deepEqual(decodeSparse(ids, buf), {
    nato: null, caccia: 'i', ius_soli: null
  });
});

test('sparse coding uses one byte per response for small position gaps', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  const buf = encodeSparse(ids, { q0: 'f', q8: 'c', q14: 'i', q30: 'f' });
  assert.equal(buf.length, 4);
  assert.deepEqual([...buf], [5, 34, 27, 65]);
  assert.equal(decodeSparse(ids, buf).q30, 'f');
  assert.equal(decodeSparse(ids, buf).q93, null);
});

test('long skip escaped with 0xFC reaches last opinion correctly', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  const buf = encodeSparse(ids, { q93: 'c' });
  assert.deepEqual([...buf], [0xfc, (31 << 2) | 2]);
  assert.equal(decodeSparse(ids, buf).q93, 'c');
});

test('long append-only catalogs work across multiple escape bytes', () => {
  const ids = Array.from({ length: 300 }, (_, i) => 'q' + i);
  const buf = encodeSparse(ids, { q299: 'f' });
  assert.deepEqual([...buf], [0xfc, 0xfc, 0xfc, 0xfc, (48 << 2) | 1]);
  assert.equal(decodeSparse(ids, buf).q299, 'f');
});

test('patch clears and changes answers without mutating original buffer', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  const orig = encodeSparse(ids, { q0: 'f', q93: 'c' });
  const snapshot = Buffer.from(orig);
  const next = patchSparse(ids, orig, { q0: null, q92: 'i', q93: 'f' });
  assert.deepEqual(orig, snapshot);
  assert.equal(decodeSparse(ids, next).q0, null);
  assert.equal(decodeSparse(ids, next).q92, 'i');
  assert.equal(decodeSparse(ids, next).q93, 'f');
});

test('catalog extension never alters existing answer positions', () => {
  const base = ['caccia', 'nato', 'energia_nucleare'];
  const compact = encodeSparse(base, { nato: 'f' });
  assert.equal(decodeSparse([...base, 'ius_soli'], compact).nato, 'f');
  assert.equal(decodeSparse([...base, 'ius_soli'], compact).ius_soli, null);
});

test('deterministic sparse and dense round trips for 94 opinions', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  let state = 0x91f2c5e3;
  const rnd = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (const density of [0, 0.01, 0.09, 0.33, 1]) {
    for (let n = 0; n < 60; n++) {
      const answer = {};
      for (const id of ids) {
        if (rnd() < density) {
          answer[id] = ['f', 'c', 'i'][Math.floor(rnd() * 3)];
        }
      }
      const packed = encodeSparse(ids, answer);
      const expected = Object.fromEntries(ids.map(id => [id, answer[id] ?? null]));
      assert.deepEqual(decodeSparse(ids, packed), expected);
      assert.ok(packed.length <= 94 + 2);
    }
  }
});

test('invalid values, catalogs, unknown indices, noncanonical encodings rejected', () => {
  const ids = ['q0', 'q1', 'q2'];
  assert.throws(() => encodeSparse(ids, { q1: 'Favorevole' }), RangeError);
  assert.throws(() => encodeSparse(ids, { q9: 'f' }), RangeError);
  assert.throws(() => encodeSparse(ids, { q1: undefined }), RangeError);
  assert.throws(() => encodeSparse(ids, []), TypeError);
  assert.throws(() => encodeSparse(['q0', 'q0'], {}), TypeError);
  assert.throws(() => decodeSparse(ids, 'bytes'), TypeError);
  assert.throws(() => decodeSparse(ids, Buffer.from([0])), RangeError);
  assert.throws(() => decodeSparse(ids, Buffer.from([0xfc])), RangeError);
  assert.throws(() => decodeSparse(ids, Buffer.from([0x04])), RangeError);
  assert.throws(() => decodeSparse(ids, Buffer.from([0x10])), RangeError);
  assert.throws(() => patchSparse(ids, Buffer.alloc(0), { q9: 'f' }), RangeError);
  assert.throws(() => patchSparse(ids, Buffer.alloc(0), { q1: 42 }), RangeError);
});
