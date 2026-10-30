'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Uses read-only prototype #247 at immutable SHA in CI. Does not duplicate
// its implementation and is not imported by production.
const {
  encodeAnswers, decodeAnswers, isAppendOnlyCatalog, catalogFingerprint
} = require('../../_ci_op247/api/utils/opinionBitset');
const { encodeSparse, decodeSparse } =
  require('../../_ci_op247/api/utils/opinionSparseBitset');

test('candidate catalog 95 can append without renumbering 94 historical slots', () => {
  const before = Array.from({length:94}, (_,i)=>'opinione_'+i);
  const after = [...before, 'opinione_94'];
  assert.equal(isAppendOnlyCatalog(before, after), true);
  assert.notEqual(catalogFingerprint(before), catalogFingerprint(after));
  const previouslyAnswered = { opinione_17:'c', opinione_93:'f' };
  const old = encodeAnswers(before, previouslyAnswered);
  assert.equal(old.length, 24);
  assert.equal(decodeAnswers(before, old).opinione_17, 'c');
  const next = encodeAnswers(after, { ...previouslyAnswered, opinione_94:'i' });
  assert.equal(decodeAnswers(after, next).opinione_17,'c');
  assert.equal(decodeAnswers(after, next).opinione_93,'f');
  assert.equal(decodeAnswers(after, next).opinione_94,'i');
});

test('removing a published opinion requires tombstone, never shift stored ordinals', () => {
  const manifest = Array.from({length:94}, (_,i)=>'opinione_'+i);
  const archivedId = 'opinione_17';
  const published = manifest.filter(id => id !== archivedId);
  assert.equal(isAppendOnlyCatalog(manifest, published),false);
  const answers = { [archivedId]:'c', opinione_93:'f' };
  const binary = encodeSparse(manifest, answers);
  assert.equal(decodeSparse(manifest,binary)[archivedId], 'c');
  assert.equal(decodeSparse(manifest,binary).opinione_93,'f');
  assert.equal(published.includes(archivedId),false);
  // Persist the original manifest for decoding; do NOT feed published
  // (filtered) IDs into a historical packed decoder.
});
