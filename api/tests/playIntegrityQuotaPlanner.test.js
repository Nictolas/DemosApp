'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { estimatePlayIntegrityQuota } = require('../services/playIntegrityQuotaPlanner');

test('default scenario at 100,000 daily users exceeds BOTH daily quotas', () => {
  const r = estimatePlayIntegrityQuota({ dailyActiveUsers: 100_000 });
  assert.equal(r.androidActive, 70_000);
  assert.equal(r.protectedActions, 10_500);
  assert.equal(r.preparations, 10_500);
  assert.equal(r.decryptions, 10_500);
  assert.equal(r.exceedsEitherQuota, true);
});

test('standard preparations are counted per prepared user, not per token', () => {
  const r = estimatePlayIntegrityQuota({
    dailyActiveUsers: 100_000,
    protectedActionsPerAndroidDau: 0.3,
    actionsPerPreparedUser: 3
  });
  assert.equal(r.protectedActions, 21_000);
  assert.equal(r.preparations, 7_000);
  assert.equal(r.decryptions, 21_000);
  assert.equal(r.preparationUtilization, 0.7);
  assert.equal(r.exceedsEitherQuota, true);
});

test('simulation covers 1 million active/day, not 1 million registered users', () => {
  const r = estimatePlayIntegrityQuota({ dailyActiveUsers: 1_000_000 });
  assert.equal(r.androidActive, 700_000);
  assert.equal(r.decryptions, 105_000);
  assert.equal(r.exceedsEitherQuota, true);
});

test('small traffic and zero traffic are within quotas', () => {
  const small = estimatePlayIntegrityQuota({ dailyActiveUsers: 1_000 });
  assert.equal(small.decryptions, 105);
  assert.equal(small.exceedsEitherQuota, false);
  const zero = estimatePlayIntegrityQuota({ dailyActiveUsers: 0 });
  assert.equal(zero.preparations, 0);
  assert.equal(zero.decryptions, 0);
});

test('invalid assumptions never lead to falsely safe projections', () => {
  for (const changes of [
    { dailyActiveUsers: -1 },
    { dailyActiveUsers: 1.5 },
    { dailyActiveUsers: 100, androidFraction: 1.1 },
    { dailyActiveUsers: 100, protectedActionsPerAndroidDau: -1 },
    { dailyActiveUsers: 100, actionsPerPreparedUser: 0 },
    { dailyActiveUsers: 100, decryptionQuota: 0 },
    { dailyActiveUsers: 100, preparationQuota: Infinity }
  ]) {
    assert.throws(() => estimatePlayIntegrityQuota(changes), RangeError);
  }
});
