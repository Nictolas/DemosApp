const {
  publishResearchAggregateRows
} = require('./researchAggregatePublicationPolicy');

const readPublishedResearchAnswerAggregates = async (
  client,
  { questionId, minimumCellSize }
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research aggregate reader requires PostgreSQL client');
  }
  if (typeof questionId !== 'string' || questionId.length === 0) {
    throw new Error('Research aggregate question id required');
  }

  const result = await client.query(
    `SELECT answer_code, COUNT(DISTINCT participant_id)::bigint AS participant_count
     FROM research.current_opinion_responses
     WHERE question_id = $1
     GROUP BY answer_code
     ORDER BY answer_code`,
    [questionId]
  );

  return publishResearchAggregateRows(result.rows, { minimumCellSize });
};

module.exports = {
  readPublishedResearchAnswerAggregates
};
