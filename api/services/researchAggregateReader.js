const {
  publishResearchAggregateRows
} = require('./researchAggregatePublicationPolicy');
const {
  buildResearchAggregateMethodology
} = require('./researchAggregateMethodology');

const readPublishedResearchAnswerAggregates = async (
  client,
  { questionId, minimumCellSize, generatedAt = new Date() }
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research aggregate reader requires PostgreSQL client');
  }
  if (typeof questionId !== 'string' || questionId.length === 0) {
    throw new Error('Research aggregate question id required');
  }

  // Build metadata first so an invalid publication policy fails closed
  // before any Research query is executed.
  const methodology = buildResearchAggregateMethodology({
    generatedAt,
    minimumCellSize
  });

  const result = await client.query(
    `SELECT answer_code, COUNT(DISTINCT participant_id)::bigint AS participant_count
     FROM research.current_opinion_responses
     WHERE question_id = $1
     GROUP BY answer_code
     ORDER BY answer_code`,
    [questionId]
  );

  return Object.freeze({
    methodology,
    rows: publishResearchAggregateRows(result.rows, { minimumCellSize })
  });
};

module.exports = {
  readPublishedResearchAnswerAggregates
};
