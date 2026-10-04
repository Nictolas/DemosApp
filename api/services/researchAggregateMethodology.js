const RESEARCH_AGGREGATE_DATASET_VERSION = 'research-answer-aggregate-v1';
const RESEARCH_AGGREGATE_SOURCE_PROJECTION = 'research.current_opinion_responses';
const RESEARCH_AGGREGATE_COUNTING_UNIT = 'distinct-participant-per-answer';
const RESEARCH_AGGREGATE_GROUPING = Object.freeze(['question_id', 'answer_code']);

const buildResearchAggregateMethodology = ({
  generatedAt = new Date(),
  minimumCellSize
} = {}) => {
  const timestamp = new Date(generatedAt);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error('Valid aggregate generation timestamp required');
  }
  if (!Number.isInteger(minimumCellSize) || minimumCellSize < 2) {
    throw new Error('Explicit aggregate minimum cell size required');
  }

  return Object.freeze({
    datasetVersion: RESEARCH_AGGREGATE_DATASET_VERSION,
    generatedAt: timestamp.toISOString(),
    sourceProjection: RESEARCH_AGGREGATE_SOURCE_PROJECTION,
    freshnessSemantics: 'active-and-unexpired-at-query-time',
    countingUnit: RESEARCH_AGGREGATE_COUNTING_UNIT,
    grouping: [...RESEARCH_AGGREGATE_GROUPING],
    suppression: Object.freeze({
      policy: 'small-cell',
      minimumCellSize
    })
  });
};

module.exports = {
  RESEARCH_AGGREGATE_DATASET_VERSION,
  RESEARCH_AGGREGATE_SOURCE_PROJECTION,
  RESEARCH_AGGREGATE_COUNTING_UNIT,
  RESEARCH_AGGREGATE_GROUPING,
  buildResearchAggregateMethodology
};
