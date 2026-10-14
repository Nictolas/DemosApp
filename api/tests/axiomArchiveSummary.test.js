const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAxiomArchiveSummary, roundHours } = require('../utils/axiomArchiveSummary');

test('roundHours converts milliseconds to bounded two-decimal hours', () => {
  assert.equal(roundHours(0), 0);
  assert.equal(roundHours(3600000), 1);
  assert.equal(roundHours(5400000), 1.5);
  assert.equal(roundHours(-1), 0);
});

test('buildAxiomArchiveSummary reports empty catch-up progress and backlog', () => {
  const [summary] = buildAxiomArchiveSummary([{
    dataset: 'centralized_logs',
    skipped: false,
    caughtUp: false,
    chunks: 24,
    count: 0,
    categories: { technical: 0, audit: 0, security: 0 },
    startTime: new Date('2026-09-01T00:00:00.000Z'),
    endTime: new Date('2026-09-07T00:00:00.000Z'),
    targetEnd: new Date('2026-10-01T00:00:00.000Z'),
    remainingMs: 24 * 24 * 60 * 60 * 1000
  }]);

  assert.deepEqual(summary, {
    dataset: 'centralized_logs',
    skipped: false,
    reason: null,
    caughtUp: false,
    chunks: 24,
    count: 0,
    empty: true,
    categories: { technical: 0, audit: 0, security: 0 },
    windowStart: '2026-09-01T00:00:00.000Z',
    windowEnd: '2026-09-07T00:00:00.000Z',
    targetEnd: '2026-10-01T00:00:00.000Z',
    progressHours: 144,
    remainingMs: 2073600000,
    remainingHours: 576
  });
});

test('buildAxiomArchiveSummary distinguishes populated caught-up runs', () => {
  const [summary] = buildAxiomArchiveSummary([{
    dataset: 'real-time',
    skipped: false,
    caughtUp: true,
    chunks: 2,
    count: 17,
    categories: { technical: 0, audit: 17, security: 0 },
    startTime: '2026-10-14T08:00:00.000Z',
    endTime: '2026-10-14T10:00:00.000Z',
    targetEnd: '2026-10-14T10:00:00.000Z',
    remainingMs: 0
  }]);

  assert.equal(summary.empty, false);
  assert.equal(summary.caughtUp, true);
  assert.equal(summary.count, 17);
  assert.equal(summary.progressHours, 2);
  assert.equal(summary.remainingHours, 0);
});

test('buildAxiomArchiveSummary preserves skip reason without marking empty', () => {
  const [summary] = buildAxiomArchiveSummary([{
    dataset: 'centralized_logs',
    skipped: true,
    reason: 'up-to-date',
    caughtUp: true,
    chunks: 0,
    count: 0
  }]);

  assert.equal(summary.skipped, true);
  assert.equal(summary.reason, 'up-to-date');
  assert.equal(summary.empty, false);
  assert.equal(summary.progressHours, 0);
  assert.equal(summary.remainingHours, 0);
});
