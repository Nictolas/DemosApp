const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validateRelayItem, buildRelayBatch } = require('../services/researchRevocationRelayBoundary');
const capability = () => crypto.randomBytes(32);

test('relay batch exposes only opaque capabilities', () => {
  const batch = buildRelayBatch(Array.from({ length: 8 }, () => ({ capability: capability() })));
  assert.equal(batch.version, 1);
  assert.equal(batch.items.length, 8);
  for (const item of batch.items) assert.deepEqual(Object.keys(item), ['capability']);
});

test('relay fails closed for correlating metadata and small batches', () => {
  for (const key of ['accountId','userId','email','participantId','participantPublicKey','credentialDigest','opinionVector','requestedAt']) {
    assert.throws(() => validateRelayItem({ capability: capability(), [key]: 'blocked' }));
  }
  assert.throws(() => validateRelayItem({ capability: capability(), extra: 'blocked' }));
  assert.throws(() => buildRelayBatch([{ capability: capability() }]));
  assert.throws(() => buildRelayBatch(Array.from({ length: 8 }, () => ({ capability: capability() })), 1));
});
