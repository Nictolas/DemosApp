import { rankCandidatesLocally, MatchVector } from './localPoliticalMatcher';

export type PoliticalVectorScope = {
  kind: 'candidate' | 'representative';
  grade: string;
  country?: string;
  region?: string;
  province?: string;
  municipality?: string;
};

type PublicPoliticalVector = {
  candidateId: string;
  displayName: string;
  avatarConfig: unknown;
  opinions: MatchVector;
};

const enabled = () => import.meta.env.VITE_PRIVACY_LOCAL_POLITICAL_MATCHING === 'true';
const baseUrl = () => import.meta.env.VITE_RESEARCH_PUBLIC_BASE_URL || '';

export const isLocalPoliticalMatchingEnabled = () => enabled() && baseUrl().length > 0;

export const fetchPoliticalVectorsForLocalMatch = async (
  scope: PoliticalVectorScope,
  fetchImpl: typeof fetch = fetch
): Promise<PublicPoliticalVector[]> => {
  if (!isLocalPoliticalMatchingEnabled()) throw new Error('Local political matching disabled');
  const response = await fetchImpl(`${baseUrl()}/v1/political-vectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    body: JSON.stringify({ scope })
  });
  if (!response.ok) throw new Error('Political vector request failed');
  const data = await response.json();
  if (!data || !Array.isArray(data.candidates)) throw new Error('Invalid political vector response');
  return data.candidates;
};

export const matchPoliticalVectorsLocally = (
  citizenOpinions: MatchVector,
  vectors: PublicPoliticalVector[],
  limit = 4
) => rankCandidatesLocally(
  citizenOpinions,
  vectors.map((item) => ({
    candidate: {
      id: item.candidateId,
      nome: item.displayName,
      avatar_config: item.avatarConfig
    },
    opinions: item.opinions
  })),
  limit
);
