'use strict';

/**
 * Experimental sparse binary coding for opinion answers.
 *
 * Each non-NULL answer is stored as one or more bytes. In a normal byte:
 *   bits 7..2 = distance (1..63) from the previous stored position,
 *   bits 1..0 = response code: 01=f, 10=c, 11=i.
 *
 * Code 00 with distance 63 (0xFC) is an ESCAPE: skip 63 slots before
 * the next byte. This permits stable append-only catalogs of any supported
 * length without changing the byte format.
 *
 * Unanswered/NULL opinions have no entry. For realistic sparse datasets,
 * most answers cost one byte rather than reserving all 94 slots.
 *
 * NO database I/O and NO concurrency guarantees. Production persistence
 * must store a catalog version and use atomic SQL updates or CAS.
 */
const { catalogFingerprint, MAX_OPINIONS } = require('./opinionBitset');

const VALUE_CODE = Object.freeze({ f: 1, c: 2, i: 3 });
const CODE_VALUE = Object.freeze([null, 'f', 'c', 'i']);
const MAX_SKIP = 63;
const ESCAPE = MAX_SKIP << 2;

function validate(ids) {
  // Reuse the canonical codec's validation of nonempty, unique ordered IDs.
  catalogFingerprint(ids);
  if (ids.length > MAX_OPINIONS) throw new RangeError('Catalog is too large');
}

function encodeSparse(orderedIds, answers) {
  validate(orderedIds);
  if (!answers || typeof answers !== 'object' ||
      Array.isArray(answers) || Buffer.isBuffer(answers)) {
    throw new TypeError('Answers must be a map');
  }
  const available = new Set(orderedIds);
  for (const id of Object.keys(answers)) {
    if (!available.has(id)) throw new RangeError('Unknown opinion ID');
  }
  const bytes = [];
  let previous = -1;
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const value = Object.prototype.hasOwnProperty.call(answers, id) ? answers[id] : null;
    if (value === null) continue;
    const code = typeof value === 'string' &&
      Object.prototype.hasOwnProperty.call(VALUE_CODE, value) ? VALUE_CODE[value] : 0;
    if (!code) throw new RangeError('Invalid opinion response; expected NULL, f, c or i');
    let distance = i - previous;
    while (distance > MAX_SKIP) {
      bytes.push(ESCAPE);
      previous += MAX_SKIP;
      distance = i - previous;
    }
    bytes.push((distance << 2) | code);
    previous = i;
  }
  return Buffer.from(bytes);
}

function decodeSparse(orderedIds, packed) {
  validate(orderedIds);
  if (!Buffer.isBuffer(packed)) throw new TypeError('Packed payload must be a Buffer');
  if (packed.length > orderedIds.length + Math.ceil(orderedIds.length / MAX_SKIP)) {
    throw new RangeError('Packed payload is impossibly large');
  }
  const answers = Object.fromEntries(orderedIds.map(id => [id, null]));
  let previous = -1;
  let unfinishedSkip = false;
  for (const byte of packed) {
    const distance = byte >>> 2;
    const code = byte & 3;
    if (distance === 0) throw new RangeError('Invalid zero-distance entry');
    const index = previous + distance;
    if (index >= orderedIds.length) throw new RangeError('Packed index outside catalog');
    if (code === 0) {
      if (distance !== MAX_SKIP) throw new RangeError('Invalid skip escape');
      unfinishedSkip = true;
    } else {
      answers[orderedIds[index]] = CODE_VALUE[code];
      unfinishedSkip = false;
    }
    previous = index;
  }
  if (unfinishedSkip) throw new RangeError('Dangling skip escape');
  if (!encodeSparse(orderedIds, answers).equals(packed)) {
    throw new RangeError('Non-canonical sparse bitset');
  }
  return answers;
}

function patchSparse(orderedIds, packed, changes) {
  const answers = decodeSparse(orderedIds, packed);
  if (!changes || typeof changes !== 'object' ||
      Array.isArray(changes) || Buffer.isBuffer(changes)) {
    throw new TypeError('Changes must be a map');
  }
  for (const [id, value] of Object.entries(changes)) {
    if (!Object.prototype.hasOwnProperty.call(answers, id)) {
      throw new RangeError('Unknown opinion ID');
    }
    answers[id] = value;
  }
  return encodeSparse(orderedIds, answers);
}

module.exports = { encodeSparse, decodeSparse, patchSparse };
