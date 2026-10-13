const VALID_ANSWERS = new Set(['f', 'c', 'i']);

function normalizeOpinionAnswer(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'f' || normalized === 'favorevole') return 'f';
  if (normalized === 'c' || normalized === 'contrario') return 'c';
  if (
    normalized === 'i' ||
    normalized === 'indeciso' ||
    normalized === 'non lo so' ||
    normalized === 'non_lo_so' ||
    normalized === 'non-lo-so'
  ) {
    return 'i';
  }

  return null;
}

function isAnsweredOpinion(value) {
  const normalized = normalizeOpinionAnswer(value);
  return normalized !== null && VALID_ANSWERS.has(normalized);
}

function getOpinionCompletion(opinionIds, answers = {}) {
  const ids = Array.isArray(opinionIds) ? opinionIds : [];
  const missingOpinionIds = ids.filter((opinionId) => !isAnsweredOpinion(answers[opinionId]));
  const answeredOpinions = ids.length - missingOpinionIds.length;

  return {
    totalOpinions: ids.length,
    answeredOpinions,
    missingOpinions: missingOpinionIds.length,
    missingOpinionIds,
    completionPercentage: ids.length > 0
      ? Math.round((answeredOpinions / ids.length) * 1000) / 10
      : 0,
    // Il matching non ha significato se il livello non contiene ancora Opinioni.
    isComplete: ids.length > 0 && missingOpinionIds.length === 0
  };
}

function scoreOpinionPair(userValue, targetValue) {
  const userAnswer = normalizeOpinionAnswer(userValue);
  const targetAnswer = normalizeOpinionAnswer(targetValue);

  if (!userAnswer || !targetAnswer) {
    return {
      points: 0,
      kind: !targetAnswer ? 'target_missing' : 'not_comparable'
    };
  }

  if (userAnswer === 'i' && targetAnswer === 'i') {
    return { points: 1, kind: 'uncertain_agreement' };
  }

  if (userAnswer === 'i' || targetAnswer === 'i') {
    return { points: 0, kind: 'mixed_uncertainty' };
  }

  if (userAnswer === targetAnswer) {
    return { points: 3, kind: 'clear_agreement' };
  }

  return { points: -1, kind: 'disagreement' };
}

function calculatePoliticalMatch(opinionIds, userAnswers = {}, targetAnswers = {}) {
  const ids = Array.isArray(opinionIds) ? opinionIds : [];

  let rawScore = 0;
  let clearAgreements = 0;
  let uncertainAgreements = 0;
  let disagreements = 0;
  let mixedUncertainty = 0;
  let targetMissing = 0;
  let knownPositions = 0;

  ids.forEach((opinionId) => {
    const targetAnswer = normalizeOpinionAnswer(targetAnswers[opinionId]);
    if (targetAnswer) knownPositions += 1;

    const result = scoreOpinionPair(userAnswers[opinionId], targetAnswers[opinionId]);
    rawScore += result.points;

    switch (result.kind) {
      case 'clear_agreement':
        clearAgreements += 1;
        break;
      case 'uncertain_agreement':
        uncertainAgreements += 1;
        break;
      case 'disagreement':
        disagreements += 1;
        break;
      case 'mixed_uncertainty':
        mixedUncertainty += 1;
        break;
      case 'target_missing':
        targetMissing += 1;
        break;
      default:
        break;
    }
  });

  const maxScore = ids.length * 3;
  const compatibilityPercentage = maxScore > 0
    ? Math.round((Math.max(0, rawScore) / maxScore) * 1000) / 10
    : 0;
  const coveragePercentage = ids.length > 0
    ? Math.round((knownPositions / ids.length) * 1000) / 10
    : 0;

  return {
    rawScore,
    maxScore,
    compatibilityPercentage,
    knownPositions,
    totalOpinions: ids.length,
    coveragePercentage,
    clearAgreements,
    uncertainAgreements,
    disagreements,
    mixedUncertainty,
    targetMissing,
    sharedOpinions: clearAgreements + uncertainAgreements
  };
}

module.exports = {
  VALID_ANSWERS,
  normalizeOpinionAnswer,
  isAnsweredOpinion,
  getOpinionCompletion,
  scoreOpinionPair,
  calculatePoliticalMatch
};
