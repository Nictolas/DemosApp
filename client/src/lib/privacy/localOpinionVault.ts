import type { MatchVector } from './localPoliticalMatcher';

const STORAGE_KEY = 'demos.local-opinion-vault.v1';
const MAX_OPINIONS = 500;

const getStorage = (): Storage => {
  if (typeof window === 'undefined' || !window.localStorage) throw new Error('Local opinion vault unavailable');
  return window.localStorage;
};

export const validateLocalOpinionVector = (value: unknown): MatchVector => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid local opinion vector');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_OPINIONS) throw new Error('Local opinion vector too large');
  const result: MatchVector = {};
  for (const [key, answer] of entries) {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new Error('Invalid opinion id');
    if (answer !== null && answer !== undefined && !['string','number','boolean'].includes(typeof answer)) {
      throw new Error('Invalid opinion answer');
    }
    result[key] = answer as MatchVector[string];
  }
  return Object.freeze(result);
};

export const readLocalOpinionVector = (): MatchVector => {
  const raw = getStorage().getItem(STORAGE_KEY);
  if (!raw) throw new Error('Local opinion vector missing');
  return validateLocalOpinionVector(JSON.parse(raw));
};

export const writeLocalOpinionVector = (vector: MatchVector): void => {
  const validated = validateLocalOpinionVector(vector);
  getStorage().setItem(STORAGE_KEY, JSON.stringify(validated));
};

export const clearLocalOpinionVector = (): void => {
  getStorage().removeItem(STORAGE_KEY);
};

export const LOCAL_OPINION_VAULT_STORAGE_KEY = STORAGE_KEY;
