const {
  assertMinimumCellSize,
  publishResearchAggregateRows
} = require('./researchAggregatePublicationPolicy');
const {
  buildResearchAggregateMethodology
} = require('./researchAggregateMethodology');

const readPublishedResearchAnswerAggregates = async (
  client,
  { questionId, minimumCellSize } = {},
  { clock = () => new Date() } = {}
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research aggregate reader requires PostgreSQL client');
  }
  if (typeof questionId !== 'string' || questionId.length === 0) {
    throw new Error('Research aggregate question id required');
  }
  if (typeof clock !== 'function') {
    throw new Error('Research aggregate reader clock required');
  }

  // Validate publication policy before touching Research storage.
  const threshold = assertMinimumCellSize(minimumCellSize);

  const result = await client.query(
    `SELECT answer_code, COUNT(DISTINCT participant_id)::bigint AS participant_count
     FROM research.current_opinion_responses
     WHERE question_id = $1
     GROUP BY answer_code
     ORDER BY answer_code`,
    [questionId]
  );

  // Publication metadata is produced by the reader after the live query.
  // It cannot be supplied by a request or precomputed materialized snapshot.
  const methodology = buildResearchAggregateMethodology({
    generatedAt: clock(),
    minimumCellSize: threshold
  });

  return Object.freeze({
    methodology,
    rows: publishResearchAggregateRows(result.rows, { minimumCellSize: threshold })
  });
};

module.exports = {
  readPublishedResearchAnswerAggregates
};
