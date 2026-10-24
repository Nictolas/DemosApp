'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CODE_TO_VALUE, requiredBytes, catalogFingerprint, isAppendOnlyCatalog, encodeAnswers,
  decodeAnswers, readAnswer, patchAnswers
} = require('../utils/opinionBitset');

test('four states map to exact high-to-low 2-bit slots', () => {
  const catalog = ['q0', 'q1', 'q2', 'q3'];
  const packed = encodeAnswers(catalog, {
    q0: null, q1: 'f', q2: 'c', q3: 'i'
  });
  assert.deepEqual(packed, Buffer.from([0b00011011]));
  assert.deepEqual(decodeAnswers(catalog, packed), {
    q0: null, q1: 'f', q2: 'c', q3: 'i'
  });
  assert.deepEqual(CODE_TO_VALUE, [null, 'f', 'c', 'i']);
});

test('missing answer and explicit NULL are both unanswered, not indeciso', () => {
  const ids = ['nato', 'caccia', 'ius_soli'];
  const packed = encodeAnswers(ids, { caccia: 'i', ius_soli: null });
  assert.deepEqual([...packed], [0b00110000]);
  assert.deepEqual(decodeAnswers(ids, packed), {
    nato: null, caccia: 'i', ius_soli: null
  });
});

test('94 opinion slots use exactly 24 bytes with zeroed padding', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'q' + i);
  assert.equal(requiredBytes(ids.length), 24);
  const empty = encodeAnswers(ids, {});
  assert.equal(empty.length, 24);
  assert.ok(empty.every(byte => byte === 0));
  const answers = Object.fromEntries(ids.map(id => [id, 'f']));
  const full = encodeAnswers(ids, answers);
  assert.equal(full.length, 24);
  assert.equal(full[23], 0b01010000);
  assert.deepEqual(decodeAnswers(ids, full), answers);
});

test('boundaries across bytes retain independent slots', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const packed = encodeAnswers(ids, { d: 'i', e: 'f', h: 'c', i: 'i' });
  assert.equal(packed.length, 3);
  assert.equal(readAnswer(ids, packed, 'd'), 'i');
  assert.equal(readAnswer(ids, packed, 'e'), 'f');
  assert.equal(readAnswer(ids, packed, 'h'), 'c');
  assert.equal(readAnswer(ids, packed, 'i'), 'i');
  assert.equal(readAnswer(ids, packed, 'a'), null);
});

test('patch modifies only nominated positions and never mutates input', () => {
  const ids = ['q0', 'q1', 'q2', 'q3', 'q4'];
  const original = encodeAnswers(ids, { q0: 'c', q1: 'i', q4: 'f' });
  const snapshot = Buffer.from(original);
  const next = patchAnswers(ids, original, { q1: 'f', q3: 'i', q4: null });
  assert.deepEqual(original, snapshot);
  assert.notStrictEqual(next, original);
  assert.deepEqual(decodeAnswers(ids, next), {
    q0: 'c', q1: 'f', q2: null, q3: 'i', q4: null
  });
});

test('empty patch is a new Buffer with unchanged contents', () => {
  const ids = ['a'];
  const packed = encodeAnswers(ids, { a: 'f' });
  const patched = patchAnswers(ids, packed, {});
  assert.notStrictEqual(patched, packed);
  assert.deepEqual(patched, packed);
});

test('append-only catalog extension preserves earlier indices', () => {
  const old = ['energia_nucleare', 'caccia', 'sionismo'];
  const v1 = encodeAnswers(old, { caccia: 'c' });
  const extended = [...old, 'auto_emissioni_zero_2035'];
  const v2 = encodeAnswers(extended, decodeAnswers(old, v1));
  assert.deepEqual(decodeAnswers(extended, v2), {
    energia_nucleare: null,
    caccia: 'c',
    sionismo: null,
    auto_emissioni_zero_2035: null
  });
  assert.equal(readAnswer(extended, v2, 'caccia'), 'c');
});

test('reorder changes position; catalog must remain immutable', () => {
  const old = ['nato', 'caccia'];
  const packed = encodeAnswers(old, { nato: 'f' });
  assert.equal(readAnswer(['caccia', 'nato'], packed, 'caccia'), 'f');
});

test('invalid values are rejected rather than silently mapped to indeciso', () => {
  const ids = ['q1'];
  for (const value of ['Favorevole', 'x', '', 0, 1, false, undefined]) {
    assert.throws(() => encodeAnswers(ids, { q1: value }), RangeError);
  }
  assert.throws(() => patchAnswers(ids, Buffer.from([0]), { q1: 'favorevole' }), RangeError);
});

test('unknown IDs, duplicates, invalid identifiers and arrays are rejected', () => {
  assert.throws(() => encodeAnswers(['a', 'a'], {}), TypeError);
  assert.throws(() => encodeAnswers(['__proto__'], {}), TypeError);
  assert.throws(() => encodeAnswers([], {}), TypeError);
  assert.throws(() => encodeAnswers(['a'], { b: 'f' }), RangeError);
  assert.throws(() => patchAnswers(['a'], Buffer.from([0]), { b: 'f' }), RangeError);
  assert.throws(() => encodeAnswers(['a'], []), TypeError);
});

test('malformed packed length, type and non-zero trailing bits are rejected', () => {
  assert.throws(() => decodeAnswers(['a'], Buffer.from([])), TypeError);
  assert.throws(() => decodeAnswers(['a'], '01'), TypeError);
  assert.throws(() => decodeAnswers(['a'], Buffer.from([0b01000001])), RangeError);
  assert.throws(() => patchAnswers(['a'], Buffer.from([1]), {}), RangeError);
  assert.throws(() => readAnswer(['a'], Buffer.from([0]), 'unknown'), RangeError);
  assert.throws(() => requiredBytes(0), RangeError);
});

test('deterministic randomized round trip for sparse and dense answers', () => {
  const ids = Array.from({ length: 94 }, (_, i) => 'op' + i);
  let state = 987654321;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let iteration = 0; iteration < 125; iteration += 1) {
    const density = iteration % 2 === 0 ? 0.09 : 0.9;
    const answers = {};
    for (const id of ids) {
      if (random() < density) {
        answers[id] = ['f', 'c', 'i'][Math.floor(random() * 3)];
      }
    }
    const packed = encodeAnswers(ids, answers);
    const expected = Object.fromEntries(ids.map(id => [id, answers[id] ?? null]));
    assert.deepEqual(decodeAnswers(ids, packed), expected);
  }
});


test('catalog fingerprint rejects reordered and removed IDs; append-only extension is allowed', () => {
  const old = ['energia_nucleare', 'caccia', 'ius_soli'];
  const next = [...old, 'carne_coltivata'];
  assert.equal(isAppendOnlyCatalog(old, next), true);
  assert.equal(isAppendOnlyCatalog(next, old), false);
  assert.equal(isAppendOnlyCatalog(old, ['caccia', 'energia_nucleare', 'ius_soli']), false);
  assert.notEqual(catalogFingerprint(old), catalogFingerprint([...old].reverse()));
  assert.equal(catalogFingerprint(old), catalogFingerprint([...old]));
});

test('stale concurrent snapshots can lose updates; database integration needs row locks or CAS', () => {
  const ids = ['caccia', 'nato', 'energia_nucleare', 'ius_soli'];
  const initial = encodeAnswers(ids, {});
  const firstWriter = patchAnswers(ids, initial, { caccia: 'f' });
  const secondWriterFromStaleSnapshot = patchAnswers(ids, initial, { ius_soli: 'c' });
  assert.equal(readAnswer(ids, secondWriterFromStaleSnapshot, 'caccia'), null);
  const secondWriterAfterLock = patchAnswers(ids, firstWriter, { ius_soli: 'c' });
  assert.equal(readAnswer(ids, secondWriterAfterLock, 'caccia'), 'f');
  assert.equal(readAnswer(ids, secondWriterAfterLock, 'ius_soli'), 'c');
});

test('round trip remains exact for varying catalog lengths and sparse values', () => {
  for (let count = 1; count <= 128; count++) {
    const ids = Array.from({ length: count }, (_, i) => 'q' + i);
    const answers = {};
    if (count > 0) answers[ids[0]] = 'f';
    if (count > 4) answers[ids[4]] = 'c';
    if (count > 40) answers[ids[40]] = 'i';
    const packed = encodeAnswers(ids, answers);
    assert.equal(packed.length, Math.ceil(count / 4));
    const decoded = decodeAnswers(ids, packed);
    for (const id of ids) assert.equal(decoded[id], answers[id] ?? null);
  }
});
