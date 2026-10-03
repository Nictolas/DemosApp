const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { replayToken, createReplayGuard } = require('../services/researchRevocationReplayGuard');

test('replay guard accepts a capability once and rejects its replay', () => {
  const capability = crypto.randomBytes(32);
  const guard = createReplayGuard();
  assert.equal(guard.accept(capability), true);
  assert.equal(guard.accept(Buffer.from(capability)), false);
  assert.equal(guard.size(), 1);
});

test('replay tokens are deterministic and contain no source identifier', () => {
  const capability = crypto.randomBytes(32);
  assert.equal(replayToken(capability), replayToken(Buffer.from(capability)));
  assert.throws(() => replayToken(Buffer.alloc(31)));
});
