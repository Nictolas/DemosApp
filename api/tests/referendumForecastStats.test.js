'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildForecastStats } = require('../services/referendumForecastStatsService');
const { bucketStart } = require('../services/referendumForecastSnapshotService');


test('forecast aggregates stay suppressed below ten responses', () => {
  const stats = buildForecastStats({
    total_responses: 9,
    yes_count: 5,
    no_count: 3,
    abstain_count: 1,
    quorum_kind: 'turnout_threshold',
    quorum_threshold: 0.5,
  });

  assert.equal(stats.suppressed, true);
  assert.equal(stats.minimumResponses, 10);
  assert.equal(stats.totalResponses, 9);
  assert.equal(stats.yesPercent, undefined);
});


test('forecast denominator separates turnout from YES-NO shares', () => {
  const stats = buildForecastStats({
    total_responses: 10,
    yes_count: 6,
    no_count: 2,
    abstain_count: 2,
    quorum_kind: 'turnout_threshold',
    quorum_threshold: 0.5,
  });

  assert.equal(stats.suppressed, false);
  assert.equal(stats.turnoutPercent, 80);
  assert.equal(stats.yesPercent, 75);
  assert.equal(stats.noPercent, 25);
  assert.equal(stats.abstainPercent, 20);
  assert.equal(stats.quorum.required, true);
  assert.equal(stats.quorum.thresholdPercent, 50);
  assert.equal(stats.quorum.forecastReached, true);
});


test('six-hour snapshot buckets are deterministic UTC windows', () => {
  assert.equal(
    bucketStart(new Date('2026-10-17T13:37:42.000Z'), 6).toISOString(),
    '2026-10-17T12:00:00.000Z',
  );
  assert.equal(
    bucketStart(new Date('2026-10-17T23:59:59.000Z'), 6).toISOString(),
    '2026-10-17T18:00:00.000Z',
  );
});


test('custom quorum remains explicitly unknown instead of being guessed', () => {
  const stats = buildForecastStats({
    total_responses: 10,
    yes_count: 5,
    no_count: 5,
    abstain_count: 0,
    quorum_kind: 'custom',
    quorum_threshold: null,
  });

  assert.equal(stats.quorum.required, true);
  assert.equal(stats.quorum.thresholdPercent, null);
  assert.equal(stats.quorum.forecastReached, null);
});
