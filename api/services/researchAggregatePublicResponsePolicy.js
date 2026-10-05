const {
  PUBLIC_ANSWER_CODES,
  MAX_PUBLISHED_AGGREGATE_ROWS,
  assertMinimumCellSize
} = require('./researchAggregatePublicationPolicy');
const {
  RESEARCH_AGGREGATE_DATASET_VERSION,
  RESEARCH_AGGREGATE_SOURCE_PROJECTION,
  RESEARCH_AGGREGATE_COUNTING_UNIT,
  RESEARCH_AGGREGATE_GROUPING,
  RESEARCH_AGGREGATE_PUBLICATION_MODE,
  RESEARCH_AGGREGATE_MATERIALIZATION,
  RESEARCH_AGGREGATE_CACHE_TTL_SECONDS
} = require('./researchAggregateMethodology');

const MAX_RESEARCH_AGGREGATE_RESPONSE_BYTES = 4096;

const assertExactMethodology = (methodology) => {
  if (!methodology || typeof methodology !== 'object' || Array.isArray(methodology)) {
    throw new Error('Invalid aggregate methodology');
  }

  const generatedAt = new Date(methodology.generatedAt);
  if (
    !Number.isFinite(generatedAt.getTime()) ||
    generatedAt.toISOString() !== methodology.generatedAt
  ) {
    throw new Error('Invalid aggregate methodology timestamp');
  }

  if (
    methodology.datasetVersion !== RESEARCH_AGGREGATE_DATASET_VERSION ||
    methodology.sourceProjection !== RESEARCH_AGGREGATE_SOURCE_PROJECTION ||
    methodology.freshnessSemantics !== 'active-and-unexpired-at-query-time' ||
    methodology.countingUnit !== RESEARCH_AGGREGATE_COUNTING_UNIT ||
    methodology.publicationMode !== RESEARCH_AGGREGATE_PUBLICATION_MODE ||
    methodology.materialization !== RESEARCH_AGGREGATE_MATERIALIZATION ||
    methodology.cacheTtlSeconds !== RESEARCH_AGGREGATE_CACHE_TTL_SECONDS ||
    !Array.isArray(methodology.grouping) ||
    methodology.grouping.length !== RESEARCH_AGGREGATE_GROUPING.length ||
    !methodology.grouping.every((value, index) => value === RESEARCH_AGGREGATE_GROUPING[index]) ||
    !methodology.suppression ||
    methodology.suppression.policy !== 'small-cell'
  ) {
    throw new Error('Unexpected aggregate methodology contract');
  }

  const minimumCellSize = assertMinimumCellSize(methodology.suppression.minimumCellSize);
  return Object.freeze({
    datasetVersion: RESEARCH_AGGREGATE_DATASET_VERSION,
    generatedAt: methodology.generatedAt,
    sourceProjection: RESEARCH_AGGREGATE_SOURCE_PROJECTION,
    freshnessSemantics: 'active-and-unexpired-at-query-time',
    countingUnit: RESEARCH_AGGREGATE_COUNTING_UNIT,
    grouping: Object.freeze([...RESEARCH_AGGREGATE_GROUPING]),
    publicationMode: RESEARCH_AGGREGATE_PUBLICATION_MODE,
    materialization: RESEARCH_AGGREGATE_MATERIALIZATION,
    cacheTtlSeconds: RESEARCH_AGGREGATE_CACHE_TTL_SECONDS,
    suppression: Object.freeze({ policy: 'small-cell', minimumCellSize })
  });
};

const assertPublicRows = (rows, minimumCellSize) => {
  if (!Array.isArray(rows) || rows.length !== MAX_PUBLISHED_AGGREGATE_ROWS) {
    throw new Error('Invalid aggregate public rows');
  }

  return Object.freeze(rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('Invalid aggregate public row');
    }

    // Fixed shape/order prevents row-presence or ordering from becoming a
    // side-channel for zero versus sub-threshold answer populations.
    if (row.answerCode !== PUBLIC_ANSWER_CODES[index]) {
      throw new Error('Invalid aggregate public answer code order');
    }

    if (row.suppressed === true) {
      if (row.participantCount !== null) {
        throw new Error('Suppressed aggregate count must remain hidden');
      }
    } else if (
      row.suppressed !== false ||
      !Number.isSafeInteger(row.participantCount) ||
      row.participantCount < minimumCellSize
    ) {
      throw new Error('Invalid published aggregate count');
    }

    return Object.freeze({
      answerCode: row.answerCode,
      suppressed: row.suppressed,
      participantCount: row.participantCount
    });
  }));
};

const buildResearchAggregatePublicResponse = ({ methodology, rows } = {}) => {
  const publicMethodology = assertExactMethodology(methodology);
  const publicRows = assertPublicRows(rows, publicMethodology.suppression.minimumCellSize);
  const response = Object.freeze({ methodology: publicMethodology, rows: publicRows });

  if (Buffer.byteLength(JSON.stringify(response), 'utf8') > MAX_RESEARCH_AGGREGATE_RESPONSE_BYTES) {
    throw new Error('Aggregate public response size bound exceeded');
  }
  return response;
};

module.exports = {
  MAX_RESEARCH_AGGREGATE_RESPONSE_BYTES,
  buildResearchAggregatePublicResponse
};
