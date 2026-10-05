const PUBLIC_ANSWER_CODES = Object.freeze(['f', 'c', 'i']);
const MAX_PUBLISHED_AGGREGATE_ROWS = PUBLIC_ANSWER_CODES.length;
const CANONICAL_COUNT_PATTERN = /^(0|[1-9]\d*)$/;

const assertMinimumCellSize = (minimumCellSize) => {
  if (!Number.isInteger(minimumCellSize) || minimumCellSize < 2) {
    throw new Error('Explicit aggregate minimum cell size >= 2 required');
  }
  return minimumCellSize;
};

const assertPublicAnswerCode = (answerCode) => {
  if (typeof answerCode !== 'string' || !PUBLIC_ANSWER_CODES.includes(answerCode)) {
    throw new Error('Invalid aggregate answer code');
  }
  return answerCode;
};

const normalizeParticipantCount = (participantCount) => {
  if (typeof participantCount === 'number') {
    if (!Number.isSafeInteger(participantCount) || participantCount < 0) {
      throw new Error('Invalid aggregate participant count');
    }
    return participantCount;
  }

  if (typeof participantCount !== 'string' || !CANONICAL_COUNT_PATTERN.test(participantCount)) {
    throw new Error('Invalid aggregate participant count');
  }

  const normalized = Number(participantCount);
  if (!Number.isSafeInteger(normalized)) {
    throw new Error('Invalid aggregate participant count');
  }
  return normalized;
};

const publishResearchAggregateCell = ({
  answerCode,
  participantCount,
  minimumCellSize
}) => {
  const threshold = assertMinimumCellSize(minimumCellSize);
  const normalizedAnswerCode = assertPublicAnswerCode(answerCode);
  const normalizedParticipantCount = normalizeParticipantCount(participantCount);

  if (normalizedParticipantCount < threshold) {
    return Object.freeze({
      answerCode: normalizedAnswerCode,
      suppressed: true,
      participantCount: null
    });
  }

  return Object.freeze({
    answerCode: normalizedAnswerCode,
    suppressed: false,
    participantCount: normalizedParticipantCount
  });
};

const publishResearchAggregateRows = (rows, { minimumCellSize } = {}) => {
  if (!Array.isArray(rows)) throw new Error('Aggregate rows required');
  if (rows.length > MAX_PUBLISHED_AGGREGATE_ROWS) {
    throw new Error('Aggregate row bound exceeded');
  }

  const threshold = assertMinimumCellSize(minimumCellSize);
  const countsByAnswerCode = new Map();

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('Invalid aggregate row');
    }
    const answerCode = assertPublicAnswerCode(row.answer_code);
    if (countsByAnswerCode.has(answerCode)) {
      throw new Error('Duplicate aggregate answer code');
    }
    countsByAnswerCode.set(answerCode, normalizeParticipantCount(row.participant_count));
  }

  // Always publish the same three rows in the same order. Missing database rows
  // are treated as zero so an observer cannot distinguish 0 from a sub-threshold
  // population merely by checking whether an answer-code row exists.
  const published = PUBLIC_ANSWER_CODES.map((answerCode) => publishResearchAggregateCell({
    answerCode,
    participantCount: countsByAnswerCode.get(answerCode) ?? 0,
    minimumCellSize: threshold
  }));

  return Object.freeze(published);
};

module.exports = {
  PUBLIC_ANSWER_CODES,
  MAX_PUBLISHED_AGGREGATE_ROWS,
  assertMinimumCellSize,
  assertPublicAnswerCode,
  normalizeParticipantCount,
  publishResearchAggregateCell,
  publishResearchAggregateRows
};
