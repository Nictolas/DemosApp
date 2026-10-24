'use strict';

// Synthetic, non-sensitive benchmark. JSON byte sizes and timings are NOT
// PostgreSQL heap/TOAST/index measurements and cannot justify a migration.
const { performance } = require('node:perf_hooks');
const { encodeAnswers, decodeAnswers } = require('../api/utils/opinionTwoBitCodec');

const count = Number(process.argv[2] || 94);
const repetitions = Number(process.argv[3] || 5000);
if (!Number.isSafeInteger(count) || count < 1 || count > 16384 ||
    !Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 1000000) {
  throw new RangeError('Usage: node scripts/benchmark-opinion-two-bit.js [opinion-count] [iterations]');
}
const ids = Array.from({ length: count }, (_, i) => 'opinion_' + i);
const densities = [0, 0.05, 0.5, 1];
const report = [];
for (const density of densities) {
  const answers = Object.fromEntries(ids.map((id, i) => [id, ((i * 37) % 100) / 100 < density ? ['f', 'c', 'i'][i % 3] : null]));
  const packed = encodeAnswers(ids, answers);
  const jsonBytes = Buffer.byteLength(JSON.stringify(answers));
  const textValuesBytes = Buffer.byteLength(ids.map(id => answers[id] ?? '').join(''));
  const started = performance.now();
  for (let i = 0; i < repetitions; i++) encodeAnswers(ids, answers);
  const encodedMs = performance.now() - started;
  const decodeStarted = performance.now();
  for (let i = 0; i < repetitions; i++) decodeAnswers(ids, packed);
  const decodedMs = performance.now() - decodeStarted;
  report.push({ density, answered: Object.values(answers).filter(Boolean).length,
    packedBytes: packed.length, jsonObjectBytes: jsonBytes, nonNullTextBytes: textValuesBytes,
    encodeUs: +(1000 * encodedMs / repetitions).toFixed(2),
    decodeUs: +(1000 * decodedMs / repetitions).toFixed(2) });
}
console.log(JSON.stringify({ kind: 'synthetic-js-only', count, repetitions,
  warning: 'Do not interpret JSON/text value sizes as PostgreSQL storage savings; measure heap/TOAST/indexes on staging.',
  results: report }, null, 2));
