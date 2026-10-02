export type MatchAnswer = string | number | boolean | null | undefined;
export type MatchVector = Record<string, MatchAnswer>;

export interface MatchCandidate<T = unknown> {
  candidate: T;
  opinions: MatchVector;
}

export interface MatchResult<T = unknown> {
  candidate: T;
  commonOpinions: number;
  comparedOpinions: number;
}

export const countLocalOpinionMatches = (
  citizen: MatchVector,
  candidate: MatchVector
): { commonOpinions: number; comparedOpinions: number } => {
  let commonOpinions = 0;
  let comparedOpinions = 0;
  for (const [opinionId, citizenValue] of Object.entries(citizen || {})) {
    const candidateValue = candidate?.[opinionId];
    if (citizenValue == null || candidateValue == null) continue;
    comparedOpinions += 1;
    if (citizenValue === candidateValue) commonOpinions += 1;
  }
  return { commonOpinions, comparedOpinions };
};

export const rankCandidatesLocally = <T>(
  citizen: MatchVector,
  candidates: MatchCandidate<T>[],
  limit = 4
): MatchResult<T>[] =>
  candidates
    .map(({ candidate, opinions }) => ({
      candidate,
      ...countLocalOpinionMatches(citizen, opinions)
    }))
    .filter((result) => result.comparedOpinions > 0)
    .sort((a, b) =>
      b.commonOpinions - a.commonOpinions ||
      b.comparedOpinions - a.comparedOpinions
    )
    .slice(0, Math.max(0, limit));
