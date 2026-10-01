const ANSWERED_VALUES = new Set(['f', 'c', 'i']);

const normalizeLimit = (value) => {
  if (!Number.isInteger(value) || value < 1) return 4;
  return Math.min(value, 4);
};

const isOpinionMap = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

const isMatchHandle = (value) =>
  typeof value === 'string' && /^mh1_[A-Za-z0-9_-]{32,64}$/.test(value);

/**
 * Pure in-memory matcher for the privacy-first client path.
 *
 * Privacy boundary:
 * - accepts no user/account identifier;
 * - accepts public-position vectors only behind opaque, context-scoped match handles;
 * - performs no network, storage or logging;
 * - returns only opaque handles and aggregate scores;
 * - caller owns acquisition/lifetime of the citizen vector.
 */
export const computeClientMatches = ({
  citizenOpinions,
  publicFigures,
  limit = 4
} = {}) => {
  if (!isOpinionMap(citizenOpinions) || !Array.isArray(publicFigures)) {
    return [];
  }

  const answeredCitizenOpinions = Object.entries(citizenOpinions)
    .filter(([, answer]) => ANSWERED_VALUES.has(answer));

  if (answeredCitizenOpinions.length === 0) {
    return [];
  }

  const ranked = [];

  for (const publicFigure of publicFigures) {
    if (!publicFigure || !isMatchHandle(publicFigure.matchHandle)) {
      continue;
    }

    const opinions = isOpinionMap(publicFigure.opinions)
      ? publicFigure.opinions
      : {};

    let commonOpinions = 0;
    let comparedOpinions = 0;

    for (const [opinionId, citizenAnswer] of answeredCitizenOpinions) {
      const publicAnswer = opinions[opinionId];
      if (!ANSWERED_VALUES.has(publicAnswer)) continue;

      comparedOpinions += 1;
      if (publicAnswer === citizenAnswer) {
        commonOpinions += 1;
      }
    }

    if (comparedOpinions === 0) continue;

    ranked.push({
      matchHandle: publicFigure.matchHandle,
      commonOpinions,
      comparedOpinions,
      matchRatio: commonOpinions / comparedOpinions
    });
  }

  ranked.sort((left, right) => {
    if (right.commonOpinions !== left.commonOpinions) {
      return right.commonOpinions - left.commonOpinions;
    }
    if (right.matchRatio !== left.matchRatio) {
      return right.matchRatio - left.matchRatio;
    }
    return left.matchHandle.localeCompare(right.matchHandle);
  });

  return ranked.slice(0, normalizeLimit(limit));
};

export const hasClientMatchableOpinions = (citizenOpinions) =>
  isOpinionMap(citizenOpinions) &&
  Object.values(citizenOpinions).some((answer) => ANSWERED_VALUES.has(answer));
