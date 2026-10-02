import type { MatchVector } from './localPoliticalMatcher';
import { validateLocalOpinionVector } from './localOpinionVault';

export type LegacyIdentityRequest = (method: 'GET', path: string) => Promise<unknown>;

export const extractLegacyOwnOpinionVector = (response: unknown): MatchVector => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Invalid legacy opinion response');
  }
  const root=response as { ok?: unknown; data?: unknown };
  if (root.ok !== true || !root.data || typeof root.data !== 'object' || Array.isArray(root.data)) {
    throw new Error('Legacy opinion request failed');
  }
  const payload=root.data as { data?: unknown };
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new Error('Invalid legacy opinion payload');
  }
  const body=payload.data as { userAnswers?: unknown };
  return validateLocalOpinionVector(body.userAnswers);
};

export const createLegacyOwnOpinionFetcher = (
  request: LegacyIdentityRequest
): (() => Promise<MatchVector>) => async () =>
  extractLegacyOwnOpinionVector(await request('GET','/api/opinioni/profile'));
