const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_CAPABILITIES, evaluateReplayStoreCandidate } = require('../services/researchRevocationReplayStoreCriteria');

test('candidate is eligible only when every privacy and atomicity capability is explicit', () => {
  const candidate = Object.fromEntries(REQUIRED_CAPABILITIES.map((key) => [key, true]));
  assert.deepEqual(evaluateReplayStoreCandidate(candidate), { eligible: true, missing: [] });
});

test('candidate fails closed when a required capability is absent or false', () => {
  const candidate = Object.fromEntries(REQUIRED_CAPABILITIES.map((key) => [key, true]));
  candidate.noIdentityMetadata = false;
  const result = evaluateReplayStoreCandidate(candidate);
  assert.equal(result.eligible, false);
  assert.deepEqual(result.missing, ['noIdentityMetadata']);
});

test('invalid candidate descriptions are rejected', () => {
  assert.throws(() => evaluateReplayStoreCandidate(null));
  assert.throws(() => evaluateReplayStoreCandidate([]));
});
