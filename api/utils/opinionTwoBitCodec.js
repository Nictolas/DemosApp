'use strict';

// Prototype only: no production route or database migration imports this module.
// 00 = unanswered, 01 = favourable, 10 = contrary, 11 = undecided.
// Four opinions fit in one byte, with the first opinion in the two most-significant bits.
// The opinion IDs MUST be stored in a persistent append-only catalog, never regenerated
// by sorting or by querying an unordered set of database columns.
const { createHash } = require('node:crypto');

const MAX_OPINIONS = 16384;
const ANSWER_TO_CODE = Object.freeze({ f: 1, c: 2, i: 3 });
const CODE_TO_ANSWER = Object.freeze([null, 'f', 'c', 'i']);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function validateCatalog(opinionIds) {
  if (!Array.isArray(opinionIds) || opinionIds.length > MAX_OPINIONS) {
    throw new TypeError('The opinion catalog must be an array within the supported limit');
  }
  const seen = new Set();
  for (const id of opinionIds) {
    if (typeof id !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(id) || seen.has(id)) {
      throw new TypeError('Opinion IDs must be unique, canonical and stable');
    }
    seen.add(id);
  }
  return opinionIds;
}

function packedByteLength(opinionCount) {
  if (!Number.isSafeInteger(opinionCount) || opinionCount < 0 || opinionCount > MAX_OPINIONS) {
    throw new RangeError('Invalid opinion count');
  }
  return Math.ceil(opinionCount / 4);
}

function catalogFingerprint(opinionIds) {
  validateCatalog(opinionIds);
  // Length-prefixed JSON is unambiguous; the order is intentionally significant.
  return createHash('sha256').update(JSON.stringify(opinionIds)).digest('hex');
}

function isAppendOnlyCatalog(previousIds, nextIds) {
  validateCatalog(previousIds);
  validateCatalog(nextIds);
  return previousIds.length <= nextIds.length &&
    previousIds.every((id, index) => id === nextIds[index]);
}

function validateAnswers(answers, opinionIds) {
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(answers))) {
    throw new TypeError('Answers must be a plain object');
  }
  const known = new Set(opinionIds);
  for (const [id, value] of Object.entries(answers)) {
    if (!known.has(id)) throw new RangeError('Unknown opinion ID');
    if (value !== null && !hasOwn(ANSWER_TO_CODE, value)) {
      throw new TypeError('Only null, f, c or i are representable');
    }
  }
}

function setCode(buffer, index, code) {
  const offset = index >> 2;
  const shift = 6 - ((index & 3) << 1);
  buffer[offset] = (buffer[offset] & ~(3 << shift)) | (code << shift);
}

function validatePayload(opinionIds, payload) {
  validateCatalog(opinionIds);
  if (!Buffer.isBuffer(payload) || payload.length !== packedByteLength(opinionIds.length)) {
    throw new TypeError('Expected a Buffer with exactly two bits per catalog opinion');
  }
  // The unused low-order bits in the final byte must always be zero.
  const unusedBits = (4 - (opinionIds.length % 4)) % 4 * 2;
  if (unusedBits && (payload[payload.length - 1] & ((1 << unusedBits) - 1)) !== 0) {
    throw new RangeError('Non-zero padding bits');
  }
}

function codeAt(payload, index) {
  return (payload[index >> 2] >> (6 - ((index & 3) << 1))) & 3;
}

function encodeAnswers(opinionIds, answers) {
  validateCatalog(opinionIds);
  validateAnswers(answers, opinionIds);
  const packed = Buffer.alloc(packedByteLength(opinionIds.length));
  opinionIds.forEach((id, index) => {
    const value = hasOwn(answers, id) ? answers[id] : null;
    if (value !== null) setCode(packed, index, ANSWER_TO_CODE[value]);
  });
  return packed;
}

function decodeAnswers(opinionIds, payload) {
  validatePayload(opinionIds, payload);
  const answers = Object.create(null);
  opinionIds.forEach((id, index) => { answers[id] = CODE_TO_ANSWER[codeAt(payload, index)]; });
  return answers;
}

function readAnswer(opinionIds, payload, opinionId) {
  validatePayload(opinionIds, payload);
  const index = opinionIds.indexOf(opinionId);
  if (index === -1) throw new RangeError('Unknown opinion ID');
  return CODE_TO_ANSWER[codeAt(payload, index)];
}

function applyAnswerPatch(opinionIds, payload, patch) {
  validatePayload(opinionIds, payload);
  validateAnswers(patch, opinionIds);
  const updated = Buffer.from(payload); // Never mutate the input or other opinions.
  for (const [id, value] of Object.entries(patch)) {
    // Normal opinion updates cannot erase an existing vote. GDPR deletion is separate.
    if (value === null) throw new TypeError('An opinion update cannot clear a vote');
    setCode(updated, opinionIds.indexOf(id), ANSWER_TO_CODE[value]);
  }
  return updated;
}

module.exports = {
  packedByteLength,
  catalogFingerprint,
  isAppendOnlyCatalog,
  encodeAnswers,
  decodeAnswers,
  readAnswer,
  applyAnswerPatch
};
