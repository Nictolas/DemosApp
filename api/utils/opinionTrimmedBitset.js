'use strict';

/**
 * Experimental variable-length representation of the same 2-bit states.
 *
 * 00=unanswered, 01=f, 10=c, 11=i. Omit trailing zero bytes, preserving
 * all internal zero slots and the immutable catalog positions.
 *
 * An all-unanswered catalog is encoded as a zero-length Buffer. This file
 * only transforms in-memory buffers. It performs NO database mutations.
 *
 * This format needs a persisted/versioned catalog in any real deployment.
 * A read-modify-write against PostgreSQL MUST use row locks or CAS; the
 * pure patch helper here provides no concurrent-write protection.
 */
const {
  requiredBytes,
  encodeAnswers,
  decodeAnswers,
  readAnswer,
  patchAnswers
} = require('./opinionBitset');

function trimTrailingZeroBytes(packed) {
  if (!Buffer.isBuffer(packed)) throw new TypeError('Packed payload must be a Buffer');
  let end = packed.length;
  while (end > 0 && packed[end - 1] === 0) end -= 1;
  return Buffer.from(packed.subarray(0, end));
}

function expandTrimmed(orderedIds, compact) {
  if (!Buffer.isBuffer(compact)) throw new TypeError('Compact payload must be a Buffer');
  if (!Array.isArray(orderedIds)) throw new TypeError('Catalog must be an array');
  const length = requiredBytes(orderedIds.length);
  if (compact.length > length) throw new RangeError('Payload longer than the catalog');
  if (compact.length && compact[compact.length - 1] === 0) {
    throw new RangeError('Payload has a non-canonical trailing zero byte');
  }
  const expanded = Buffer.alloc(length);
  compact.copy(expanded, 0);
  // Reuse the base codec for catalog and padding-bit validation.
  decodeAnswers(orderedIds, expanded);
  return expanded;
}

function encodeTrimmed(orderedIds, answers) {
  return trimTrailingZeroBytes(encodeAnswers(orderedIds, answers));
}

function decodeTrimmed(orderedIds, compact) {
  return decodeAnswers(orderedIds, expandTrimmed(orderedIds, compact));
}

function readTrimmed(orderedIds, compact, opinionId) {
  return readAnswer(orderedIds, expandTrimmed(orderedIds, compact), opinionId);
}

function patchTrimmed(orderedIds, compact, changes) {
  const expanded = expandTrimmed(orderedIds, compact);
  return trimTrailingZeroBytes(patchAnswers(orderedIds, expanded, changes));
}

module.exports = {
  trimTrailingZeroBytes,
  expandTrimmed,
  encodeTrimmed,
  decodeTrimmed,
  readTrimmed,
  patchTrimmed
};
