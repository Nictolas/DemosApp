'use strict';

/**
 * Proof of concept ONLY: compact opinion values into a versioned, ordered bitset.
 *
 * 00 = unanswered (NULL), 01 = favorevole ('f'),
 * 10 = contrario ('c'), 11 = indeciso ('i').
 *
 * One byte holds four answers, most-significant slot first.
 * The caller MUST provide an immutable ordered catalog of stable opinion IDs.
 * Never derive its order from SQL column order, an unordered query or display text.
 *
 * This module has no database, HTTP or logging side effects. The in-memory
 * patch() function is NOT a concurrency-safe database update; a production
 * implementation must atomically update individual slots (or use a lock/CAS).
 */
const { createHash } = require('node:crypto');
const CODE_TO_VALUE = Object.freeze([null, 'f', 'c', 'i']);
const VALUE_TO_CODE = Object.freeze({ f: 1, c: 2, i: 3 });
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_OPINIONS = 65535;

function validateCatalog(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 ||
      orderedIds.length > MAX_OPINIONS) {
    throw new TypeError('Catalog must be a non-empty ordered array of at most 65535 IDs');
  }
  const seen = new Set();
  for (const id of orderedIds) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || seen.has(id)) {
      throw new TypeError('Catalog contains an invalid or duplicate opinion ID');
    }
    seen.add(id);
  }
  return seen;
}

function requiredBytes(opinionCount) {
  if (!Number.isSafeInteger(opinionCount) || opinionCount < 1 ||
      opinionCount > MAX_OPINIONS) {
    throw new RangeError('Invalid opinion count');
  }
  return Math.ceil(opinionCount / 4);
}

function assertPacked(packed, opinionCount) {
  if (!Buffer.isBuffer(packed) || packed.length !== requiredBytes(opinionCount)) {
    throw new TypeError('Packed answers must be a Buffer with the exact catalog length');
  }
  const unusedSlots = (4 - opinionCount % 4) % 4;
  if (unusedSlots && (packed[packed.length - 1] & ((1 << (unusedSlots * 2)) - 1))) {
    throw new RangeError('Non-zero unused padding bits');
  }
}

function assertMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map) ||
      Buffer.isBuffer(map)) {
    throw new TypeError('Answers must be a plain opinion-ID map');
  }
}

function codeFor(value) {
  if (value === null) return 0;
  if (typeof value === 'string' &&
      Object.prototype.hasOwnProperty.call(VALUE_TO_CODE, value)) {
    return VALUE_TO_CODE[value];
  }
  throw new RangeError("Invalid opinion response: expected NULL, 'f', 'c' or 'i'");
}

function readCode(packed, index) {
  return (packed[index >> 2] >>> (6 - 2 * (index & 3))) & 3;
}

function writeCode(packed, index, code) {
  const byteIndex = index >> 2;
  const shift = 6 - 2 * (index & 3);
  const mask = 3 << shift;
  packed[byteIndex] = (packed[byteIndex] & ~mask) | (code << shift);
}

function encodeAnswers(orderedIds, answers) {
  const allowed = validateCatalog(orderedIds);
  assertMap(answers);
  for (const id of Object.keys(answers)) {
    if (!allowed.has(id)) throw new RangeError('Answer ID not present in catalog');
  }
  const packed = Buffer.alloc(requiredBytes(orderedIds.length));
  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i];
    if (Object.prototype.hasOwnProperty.call(answers, id)) {
      writeCode(packed, i, codeFor(answers[id]));
    }
  }
  return packed;
}

function decodeAnswers(orderedIds, packed) {
  validateCatalog(orderedIds);
  assertPacked(packed, orderedIds.length);
  const answers = {};
  for (let i = 0; i < orderedIds.length; i += 1) {
    answers[orderedIds[i]] = CODE_TO_VALUE[readCode(packed, i)];
  }
  return answers;
}

function readAnswer(orderedIds, packed, opinionId) {
  validateCatalog(orderedIds);
  assertPacked(packed, orderedIds.length);
  const index = orderedIds.indexOf(opinionId);
  if (index === -1) throw new RangeError('Unknown opinion ID');
  return CODE_TO_VALUE[readCode(packed, index)];
}

function patchAnswers(orderedIds, packed, changedAnswers) {
  const allowed = validateCatalog(orderedIds);
  assertPacked(packed, orderedIds.length);
  assertMap(changedAnswers);
  const copy = Buffer.from(packed);
  for (const [id, value] of Object.entries(changedAnswers)) {
    if (!allowed.has(id)) throw new RangeError('Answer ID not present in catalog');
    writeCode(copy, orderedIds.indexOf(id), codeFor(value));
  }
  return copy;
}


/**
 * Stable fingerprint of the exact ordered catalog; never use this in place
 * of storing an explicit catalog version beside each persisted bitset.
 */
function catalogFingerprint(orderedIds) {
  validateCatalog(orderedIds);
  return createHash('sha256').update(JSON.stringify(orderedIds)).digest('hex');
}

/** New catalogs may append IDs but must never reorder, remove or reuse slots. */
function isAppendOnlyCatalog(previousIds, nextIds) {
  validateCatalog(previousIds);
  validateCatalog(nextIds);
  return previousIds.length <= nextIds.length &&
    previousIds.every((id, index) => id === nextIds[index]);
}

module.exports = {
  CODE_TO_VALUE,
  MAX_OPINIONS,
  requiredBytes,
  catalogFingerprint,
  isAppendOnlyCatalog,
  encodeAnswers,
  decodeAnswers,
  readAnswer,
  patchAnswers
};
