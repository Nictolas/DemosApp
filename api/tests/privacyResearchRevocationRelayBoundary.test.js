const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  validateRelayItem,
  validateRelayBatch,
  buildRelayBatch
} = require('../services/researchRevocationRelayBoundary');
const capability = () => crypto.randomBytes(32);

test('relay batch exposes only opaque shuffled capabilities', () => {
  const items = Array.from({ length: 8 }, () => ({ capability: capability() }));
  const batch = buildRelayBatch(items, 8, () => 0);
  assert.equal(batch.version, 1);
  assert.equal(batch.items.length, 8);
  for (const item of batch.items) assert.deepEqual(Object.keys(item), ['capability']);
  assert.notDeepEqual(batch.items.map((item) => item.capability), items.map((item) => item.capability));
  assert.deepEqual(validateRelayBatch(batch), batch);
});

test('relay fails closed for correlating metadata and small batches', () => {
  for (const key of ['accountId','userId','email','participantId','participantPublicKey','credentialDigest','opinionVector','requestedAt','requestId','receiptId']) {
    assert.throws(() => validateRelayItem({ capability: capability(), [key]: 'blocked' }));
  }
  assert.throws(() => validateRelayItem({ capability: capability(), extra: 'blocked' }));
  assert.throws(() => buildRelayBatch([{ capability: capability() }]));
  assert.throws(() => buildRelayBatch(Array.from({ length: 8 }, () => ({ capability: capability() })), 1));
});

test('duplicate capabilities cannot satisfy the batch privacy threshold', () => {
  const repeated = Buffer.alloc(32, 7);
  assert.throws(
    () => buildRelayBatch(Array.from({ length: 8 }, () => ({ capability: repeated })), 8, () => 0),
    /distinct opaque capabilities/i
  );
});

test('batch-level metadata is rejected before Research processing', () => {
  const batch = buildRelayBatch(Array.from({ length: 8 }, () => ({ capability: capability() })), 8, () => 0);
  assert.throws(() => validateRelayBatch({ ...batch, requestedAt: new Date().toISOString() }), /Invalid relay batch envelope/);
});
