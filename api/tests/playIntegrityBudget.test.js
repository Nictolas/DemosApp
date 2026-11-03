'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLocalDecodeBudget, DEFAULT_MAX_DECODE_PER_DAY_PER_PROCESS } = require('../services/playIntegrityBudget');

test('local guard only allows bounded calls per UTC day', () => {
  const b = createLocalDecodeBudget({ maxDaily: 2 });
  const dayOne = Date.parse('2026-11-03T00:00:00Z');
  assert.equal(b.remaining(dayOne), 2);
  assert.equal(b.reserve(dayOne), true);
  assert.equal(b.reserve(dayOne + 1), true);
  assert.equal(b.reserve(dayOne + 2), false);
  assert.equal(b.remaining(dayOne + 2), 0);
  assert.equal(b.reserve(dayOne + 86400000), true);
  assert.equal(b.remaining(dayOne + 86400000), 1);
});

test('zero quota disables local reservation completely', () => {
  const b = createLocalDecodeBudget({ maxDaily: 0 });
  assert.equal(b.reserve(Date.parse('2026-11-03')), false);
  assert.equal(b.remaining(Date.parse('2026-11-03')), 0);
});

test('invalid quotas and clock values are rejected', () => {
  for (const maxDaily of [-1, 1001, 1.5, NaN, Infinity]) {
    assert.throws(() => createLocalDecodeBudget({ maxDaily }), RangeError);
  }
  const b = createLocalDecodeBudget();
  assert.equal(b.reserve(-1), false);
  assert.equal(b.reserve(NaN), false);
  assert.equal(b.maxDaily, DEFAULT_MAX_DECODE_PER_DAY_PER_PROCESS);
  assert.ok(b.maxDaily < 10000);
});

test('UTC rollback never restores the per-process Play Integrity decode budget', () => {
  const b = createLocalDecodeBudget({ maxDaily: 2 });
  const dayOne = Date.parse('2026-11-03T12:00:00Z');
  const dayBefore = Date.parse('2026-11-02T12:00:00Z');
  const dayAfter = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(b.reserve(dayOne), true);
  assert.equal(b.remaining(dayOne), 1);
  assert.equal(b.reserve(dayBefore), false);
  assert.equal(b.remaining(dayBefore), 0);
  assert.equal(b.remaining(dayOne), 1);
  assert.equal(b.reserve(dayOne + 1000), true);
  assert.equal(b.reserve(dayOne + 2000), false);
  assert.equal(b.reserve(dayBefore), false);
  assert.equal(b.remaining(dayOne), 0);
  assert.equal(b.reserve(dayAfter), true);
  assert.equal(b.remaining(dayAfter), 1);
  assert.equal(b.reserve(dayOne), false);
  assert.equal(b.remaining(dayOne), 0);
  assert.equal(b.remaining(dayAfter), 1);
});

test('parallel reservations cannot exceed the local cap', async () => {
  const b = createLocalDecodeBudget({ maxDaily: 5 });
  const time = Date.parse('2026-11-03');
  const reservations = await Promise.all(Array.from({ length: 200 }, async () => b.reserve(time)));
  assert.equal(reservations.filter(Boolean).length, 5);
});
