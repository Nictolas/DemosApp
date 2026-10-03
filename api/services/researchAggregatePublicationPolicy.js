const assertMinimumCellSize = (minimumCellSize) => {
  if (!Number.isInteger(minimumCellSize) || minimumCellSize < 2) {
    throw new Error('Explicit aggregate minimum cell size >= 2 required');
  }
  return minimumCellSize;
};

const publishResearchAggregateCell = ({
  answerCode,
  participantCount,
  minimumCellSize
}) => {
  const threshold = assertMinimumCellSize(minimumCellSize);
  if (typeof answerCode !== 'string' || answerCode.length === 0) {
    throw new Error('Aggregate answer code required');
  }
  if (!Number.isInteger(participantCount) || participantCount < 0) {
    throw new Error('Invalid aggregate participant count');
  }

  if (participantCount < threshold) {
    return Object.freeze({
      answerCode,
      suppressed: true,
      participantCount: null
    });
  }

  return Object.freeze({
    answerCode,
    suppressed: false,
    participantCount
  });
};

const publishResearchAggregateRows = (rows, { minimumCellSize } = {}) => {
  if (!Array.isArray(rows)) throw new Error('Aggregate rows required');
  const threshold = assertMinimumCellSize(minimumCellSize);
  return rows.map((row) => publishResearchAggregateCell({
    answerCode: row.answer_code,
    participantCount: Number(row.participant_count),
    minimumCellSize: threshold
  }));
};

module.exports = {
  assertMinimumCellSize,
  publishResearchAggregateCell,
  publishResearchAggregateRows
};
