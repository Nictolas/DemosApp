import type { PoliticalVectorScope } from './researchPoliticalMatchingClient';
import { fetchPoliticalVectorsForLocalMatch, matchPoliticalVectorsLocally } from './researchPoliticalMatchingClient';
import type { CitizenOpinionVectorSource } from './citizenOpinionVectorSource';

export interface CitizenOpinionVectorReader {
  read(): Promise<CitizenOpinionVectorSource>;
}

export const runLocalPoliticalMatchingPipeline = async ({
  source,
  scope,
  limit = 4,
  fetchImpl = fetch
}: {
  source: CitizenOpinionVectorReader;
  scope: PoliticalVectorScope;
  limit?: number;
  fetchImpl?: typeof fetch;
}) => {
  const { vector } = await source.read();
  const publicVectors = await fetchPoliticalVectorsForLocalMatch(scope, fetchImpl);
  return matchPoliticalVectorsLocally(vector, publicVectors, limit);
};
