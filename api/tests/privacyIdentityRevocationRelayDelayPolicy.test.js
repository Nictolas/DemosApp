const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateDelayedRelayCohort } = require('../services/identityRevocationRelayDelayPolicy');

const baseNow = new Date('2026-10-03T12:00:00.000Z');
const request = (index, ageMs) => ({
  accountId: 'account-' + index,
  queuedAt: new Date(baseNow.getTime() - ageMs).toISOString()
});

test('delayed relay dispatches only after both delay and privacy threshold are satisfied', () => {
  const requests = Array.from({ length: 8 }, (_, index) => request(index, 60_000 + index));
  const result = evaluateDelayedRelayCohort({
    requests,
    now: baseNow,
    minimumBatchSize: 8,
    minimumDelayMs: 30_000,
    maximumHoldMs: 300_000
  });
  assert.equal(result.dispatch, true);
  assert.equal(result.reason, 'BATCH_READY');
  assert.equal(result.requiresIntervention, false);
  assert.equal(result.accountIds.length, 8);
});

test('privacy threshold is never weakened when bounded latency is exceeded', () => {
  const requests = Array.from({ length: 7 }, (_, index) => request(index, 600_000 + index));
  const result = evaluateDelayedRelayCohort({
    requests,
    now: baseNow,
    minimumBatchSize: 8,
    minimumDelayMs: 30_000,
    maximumHoldMs: 300_000
  });
  assert.deepEqual(result, {
    dispatch: false,
    reason: 'PRIVACY_THRESHOLD_BLOCKS_BOUNDED_LATENCY',
    requiresIntervention: true,
    accountIds: []
  });
});

test('queue snapshot never accepts plaintext capability or extra correlating fields', () => {
  assert.throws(() => evaluateDelayedRelayCohort({
    requests: [{ ...request(1, 60_000), capability: Buffer.alloc(32, 1) }],
    now: baseNow,
    minimumDelayMs: 30_000,
    maximumHoldMs: 300_000
  }), /only Identity reference and queuedAt/);
});

test('duplicates and future queue times fail closed', () => {
  const duplicate = request(1, 60_000);
  assert.throws(() => evaluateDelayedRelayCohort({
    requests: [duplicate, duplicate],
    now: baseNow,
    minimumDelayMs: 30_000,
    maximumHoldMs: 300_000
  }), /Duplicate relay account reference/);

  assert.throws(() => evaluateDelayedRelayCohort({
    requests: [{ accountId: 'future', queuedAt: new Date(baseNow.getTime() + 1).toISOString() }],
    now: baseNow,
    minimumDelayMs: 30_000,
    maximumHoldMs: 300_000
  }), /Future relay queuedAt forbidden/);
});
