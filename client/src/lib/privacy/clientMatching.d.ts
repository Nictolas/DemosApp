export type PoliticalAnswer = 'f' | 'c' | 'i' | null | undefined;

export type CitizenOpinionVector = Record<string, PoliticalAnswer>;

export interface PublicFigureMatchInput {
  matchHandle: string;
  opinions: Record<string, PoliticalAnswer>;
}

export interface ClientMatchResult {
  matchHandle: string;
  commonOpinions: number;
  comparedOpinions: number;
  matchRatio: number;
}

export interface ClientMatchInput {
  citizenOpinions: CitizenOpinionVector;
  publicFigures: PublicFigureMatchInput[];
  limit?: number;
}

export function computeClientMatches(input?: Partial<ClientMatchInput>): ClientMatchResult[];
export function hasClientMatchableOpinions(citizenOpinions: unknown): boolean;
