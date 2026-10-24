'use strict';

/**
 * Deterministic SYNTHETIC benchmark. No database connection and no real users.
 *
 * This estimates raw data-value bytes ONLY. It does NOT calculate PostgreSQL
 * heap rows, NULL bitmaps in context, alignment, index/TOAST, WAL or query cost.
 *
 * PostgreSQL currently stores one-character TEXT answers at ~2 bytes each
 * (short varlena), while NULL answers are omitted from the value area.
 * A fixed 94-slot 2-bit bitset occupies 24 bytes even when all are unanswered.
 */
const { performance } = require('node:perf_hooks');
const {
  encodeAnswers, decodeAnswers, requiredBytes
} = require('../utils/opinionBitset');

const COUNT = 94;
const CASES = 1000;
const catalog = Array.from({ length: COUNT }, (_, i) => 'q' + i);
const densities = [0, 0.05, 8.32 / COUNT, 0.33, 1];
let state = 0x71f9234a;
function random() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 0x100000000;
}

function trial(density) {
  let totalAnswers = 0;
  let totalTextValueBytes = 0;
  let checksum = 0;
  const start = performance.now();
  for (let caseNo = 0; caseNo < CASES; caseNo++) {
    const answers = {};
    for (const id of catalog) {
      if (random() < density) {
        answers[id] = ['f', 'c', 'i'][Math.floor(random() * 3)];
        totalAnswers++;
      }
    }
    const packed = encodeAnswers(catalog, answers);
    const decoded = decodeAnswers(catalog, packed);
    for (const id of catalog) {
      if (decoded[id] !== (answers[id] ?? null)) {
        throw new Error('Round-trip mismatch');
      }
    }
    // Only raw values, excluding PostgreSQL row and nullable bitmap overhead.
    totalTextValueBytes += 2 * Object.keys(answers).length;
    checksum ^= packed[0];
  }
  const elapsedMs = performance.now() - start;
  return {
    density: Number(density.toFixed(3)),
    meanAnswered: Number((totalAnswers / CASES).toFixed(2)),
    meanTextValueBytesOnly: Number((totalTextValueBytes / CASES).toFixed(2)),
    packedValueBytesOnly: requiredBytes(COUNT),
    elapsedMs: Number(elapsedMs.toFixed(1)),
    checksum
  };
}

console.log('2-bit codec: deterministic synthetic benchmark; NOT a PostgreSQL storage benchmark');
console.table(densities.map(trial));
console.log('Production read-only snapshot 2026-10-24: 824 rows, mean 8.32 answered, median 6.');
console.log('Important: at low response density, packed fixed slots may be larger than');
console.log('one-character TEXT values plus their nullable bitmap. Measure pg_total_relation_size');
console.log('and query performance on staging before considering any database migration.');
