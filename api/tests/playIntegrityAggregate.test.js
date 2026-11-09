'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlayIntegrityAggregate, MIN_PUBLIC_SAMPLES } = require('../services/playIntegrityAggregate');

const time = Date.parse('2026-11-03T12:00:00Z');

test('aggregate contains only coarse statuses, never user-controlled details', () => {
  const aggregate = createPlayIntegrityAggregate();
  for (let i = 0; i < MIN_PUBLIC_SAMPLES; i++) {
    aggregate.record({ status: 'verified', rawToken: 'SECRET', userId: i,
      payload: { politicalOpinion: 'PRIVATE' }, reason: 'user@example.com' }, time);
  }
  const out = aggregate.snapshot(time);
  assert.deepEqual(out, {
    day: '2026-11-03', total: MIN_PUBLIC_SAMPLES,
    counts: { verified: MIN_PUBLIC_SAMPLES, untrusted: 0, unavailable: 0, disabled: 0 }
  });
  assert.doesNotMatch(JSON.stringify(out), /SECRET|PRIVATE|@|userId/);
});

test('no snapshot for small groups or previous day and no event timestamps', () => {
  const aggregate = createPlayIntegrityAggregate();
  for (let i = 0; i < 19; i++) aggregate.record({ status: 'untrusted' }, time);
  assert.equal(aggregate.snapshot(time), null);
  aggregate.record({ status: 'unavailable' }, time);
  assert.equal(aggregate.snapshot(time).counts.unavailable, 1);
  assert.equal(aggregate.snapshot(time + 86400000), null);
  aggregate.record({ status: 'disabled' }, time + 86400000);
  assert.equal(aggregate.snapshot(time + 86400000), null);
});

test('rejects unknown verdicts and undersized threshold', () => {
  assert.throws(() => createPlayIntegrityAggregate({ minSamples: 1 }), RangeError);
  const aggregate = createPlayIntegrityAggregate();
  assert.equal(aggregate.record({ status: 'ATTACKER_TOKEN' }, time), false);
  assert.equal(aggregate.record({ status: 'verified' }, -1), false);
  assert.equal(aggregate.snapshot(time), null);
});
