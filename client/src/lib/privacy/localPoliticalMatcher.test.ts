import { describe, expect, it } from 'vitest';
import { countLocalOpinionMatches, rankCandidatesLocally } from './localPoliticalMatcher';

describe('localPoliticalMatcher', () => {
  it('matches entirely from caller-supplied local vectors', () => {
    expect(countLocalOpinionMatches(
      { q1: 2, q2: 1, q3: null },
      { q1: 2, q2: 0, q3: 2 }
    )).toEqual({ commonOpinions: 1, comparedOpinions: 2 });
  });

  it('ranks candidates locally and excludes candidates with no comparable opinions', () => {
    const ranked = rankCandidatesLocally(
      { q1: 2, q2: 1 },
      [
        { candidate: { id: 'a' }, opinions: { q1: 2, q2: 1 } },
        { candidate: { id: 'b' }, opinions: { q1: 2, q2: 0 } },
        { candidate: { id: 'c' }, opinions: { q1: null, q2: null } }
      ]
    );
    expect(ranked.map((item) => [item.candidate.id, item.commonOpinions]))
      .toEqual([['a', 2], ['b', 1]]);
  });
});
