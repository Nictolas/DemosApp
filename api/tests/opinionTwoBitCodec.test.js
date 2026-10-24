'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  packedByteLength, catalogFingerprint, isAppendOnlyCatalog,
  encodeAnswers, decodeAnswers, readAnswer, applyAnswerPatch
} = require('../utils/opinionTwoBitCodec');

const ids = (n) => Array.from({ length: n }, (_, i) => 'opinion_' + i);

for (const [value, hex] of [[null, '00'], ['f', '40'], ['c', '80'], ['i', 'c0']]) {
  test('maps ' + String(value) + ' to exact 2-bit value ' + hex, () => {
    const payload = encodeAnswers(['opinion_0'], { opinion_0: value });
    assert.equal(payload.toString('hex'), hex);
    assert.equal(decodeAnswers(['opinion_0'], payload).opinion_0, value);
  });
}

test('packs four values into one byte, MSB first', () => {
  const catalog = ids(4);
  const packed = encodeAnswers(catalog, {
    opinion_0: null, opinion_1: 'f', opinion_2: 'c', opinion_3: 'i'
  });
  assert.equal(packed.toString('hex'), '1b');
  assert.deepEqual(Object.values(decodeAnswers(catalog, packed)), [null, 'f', 'c', 'i']);
});

test('94 opinions use exactly 24 raw bytes; last four padding bits are zero', () => {
  const catalog = ids(94);
  const answers = Object.fromEntries(catalog.map((id, i) => [id, [null, 'f', 'c', 'i'][i % 4]]));
  const packed = encodeAnswers(catalog, answers);
  assert.equal(packed.length, 24);
  assert.equal(packed[23] & 0x0f, 0);
  assert.deepEqual({ ...decodeAnswers(catalog, packed) }, answers);
});

test('sparse unanswered opinions remain null and do not shift other bits', () => {
  const catalog = ids(97);
  const answers = { opinion_0: 'f', opinion_47: 'c', opinion_96: 'i' };
  const packed = encodeAnswers(catalog, answers);
  assert.equal(packed.length, 25);
  assert.equal(Object.values(decodeAnswers(catalog, packed)).filter(Boolean).length, 3);
  for (const [id, answer] of Object.entries(answers)) assert.equal(readAnswer(catalog, packed, id), answer);
  assert.equal(readAnswer(catalog, packed, 'opinion_1'), null);
});

test('patch changes only selected opinions without mutating original Buffer', () => {
  const catalog = ids(8);
  const original = encodeAnswers(catalog, { opinion_0: 'f', opinion_3: 'i' });
  const snapshot = Buffer.from(original);
  const updated = applyAnswerPatch(catalog, original, { opinion_1: 'c', opinion_3: 'f' });
  assert.deepEqual(original, snapshot);
  assert.deepEqual({ ...decodeAnswers(catalog, updated) }, {
    opinion_0: 'f', opinion_1: 'c', opinion_2: null, opinion_3: 'f',
    opinion_4: null, opinion_5: null, opinion_6: null, opinion_7: null
  });
});

test('sequential disjoint patches preserve both changes (DB transaction must serialize them)', () => {
  const catalog = ids(5);
  const original = encodeAnswers(catalog, {});
  const afterFirst = applyAnswerPatch(catalog, original, { opinion_1: 'f' });
  const afterSecond = applyAnswerPatch(catalog, afterFirst, { opinion_4: 'c' });
  assert.equal(readAnswer(catalog, afterSecond, 'opinion_1'), 'f');
  assert.equal(readAnswer(catalog, afterSecond, 'opinion_4'), 'c');
  // A stale snapshot loses updates: integration must use SELECT FOR UPDATE / CAS.
  const stale = applyAnswerPatch(catalog, original, { opinion_4: 'c' });
  assert.equal(readAnswer(catalog, stale, 'opinion_1'), null);
});

test('append-only catalog preserves existing indices and fingerprint detects reorder', () => {
  const original = ids(94);
  const extended = [...original, 'new_opinion'];
  assert.equal(isAppendOnlyCatalog(original, extended), true);
  assert.equal(isAppendOnlyCatalog(extended, original), false);
  const reordered = [...original].reverse();
  assert.equal(isAppendOnlyCatalog(original, reordered), false);
  assert.notEqual(catalogFingerprint(original), catalogFingerprint(reordered));
  assert.equal(catalogFingerprint(original), catalogFingerprint([...original]));
  assert.equal(encodeAnswers(extended, { opinion_0: 'f' }).subarray(0, 24).toString('hex'),
    encodeAnswers(original, { opinion_0: 'f' }).toString('hex'));
});

test('rejects duplicate, unsafe, non-canonical and oversized catalogs', () => {
  for (const catalog of [['x', 'x'], ['Bad_ID'], ['a";drop'], [1], null, ids(16385)]) {
    assert.throws(() => encodeAnswers(catalog, {}));
  }
  assert.throws(() => packedByteLength(-1));
  assert.throws(() => packedByteLength(1.5));
});

test('rejects unknown answers, invalid values, malformed payload and forbidden clearing', () => {
  const catalog = ids(3);
  const payload = encodeAnswers(catalog, { opinion_0: 'f' });
  assert.throws(() => encodeAnswers(catalog, { unknown: 'f' }));
  assert.throws(() => encodeAnswers(catalog, { opinion_0: 'yes' }));
  assert.throws(() => encodeAnswers(catalog, { opinion_0: undefined }));
  assert.throws(() => encodeAnswers(catalog, []));
  assert.throws(() => decodeAnswers(catalog, Buffer.alloc(2)));
  assert.throws(() => decodeAnswers(catalog, '40'));
  assert.throws(() => decodeAnswers(catalog, Buffer.from([0x41]))); // padding not zero
  assert.throws(() => readAnswer(catalog, payload, 'unknown'));
  assert.throws(() => applyAnswerPatch(catalog, payload, { opinion_0: null }));
});

test('deterministic roundtrip across all byte boundaries and sparse/dense mixes', () => {
  let seed = 0x12345678;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
  for (let n = 0; n <= 128; n++) {
    const catalog = ids(n);
    for (const density of [0, 0.05, 0.5, 1]) {
      const answers = {};
      for (const id of catalog) {
        const pick = random();
        if (pick < density) answers[id] = ['f', 'c', 'i'][Math.floor(random() * 3)];
      }
      const payload = encodeAnswers(catalog, answers);
      assert.equal(payload.length, packedByteLength(n));
      const restored = decodeAnswers(catalog, payload);
      for (const id of catalog) assert.equal(restored[id], answers[id] ?? null);
    }
  }
});
