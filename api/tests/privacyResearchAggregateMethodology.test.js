const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_AGGREGATE_DATASET_VERSION,
  RESEARCH_AGGREGATE_SOURCE_PROJECTION,
  RESEARCH_AGGREGATE_COUNTING_UNIT,
  RESEARCH_AGGREGATE_GROUPING,
  buildResearchAggregateMethodology
} = require('../services/researchAggregateMethodology');

test('aggregate methodology is explicit, versioned and freshness-bound', () => {
  const methodology = buildResearchAggregateMethodology({
    generatedAt: '2026-10-04T01:00:00Z',
    minimumCellSize: 8
  });

  assert.deepEqual(methodology, {
    datasetVersion: RESEARCH_AGGREGATE_DATASET_VERSION,
    generatedAt: '2026-10-04T01:00:00.000Z',
    sourceProjection: RESEARCH_AGGREGATE_SOURCE_PROJECTION,
    freshnessSemantics: 'active-and-unexpired-at-query-time',
    countingUnit: RESEARCH_AGGREGATE_COUNTING_UNIT,
    grouping: [...RESEARCH_AGGREGATE_GROUPING],
    suppression: {
      policy: 'small-cell',
      minimumCellSize: 8
    }
  });
  assert.equal(methodology.sourceProjection, 'research.current_opinion_responses');
  assert.equal(methodology.countingUnit, 'distinct-participant-per-answer');
  assert.deepEqual(methodology.grouping, ['question_id', 'answer_code']);
});

test('aggregate methodology fails closed without an explicit valid suppression threshold', () => {
  assert.throws(() => buildResearchAggregateMethodology({
    generatedAt: '2026-10-04T01:00:00Z'
  }), /minimum cell size/i);
  assert.throws(() => buildResearchAggregateMethodology({
    generatedAt: '2026-10-04T01:00:00Z',
    minimumCellSize: 1
  }), /minimum cell size/i);
});

test('aggregate methodology rejects invalid generation timestamps', () => {
  assert.throws(() => buildResearchAggregateMethodology({
    generatedAt: 'not-a-date',
    minimumCellSize: 8
  }), /generation timestamp/i);
});
