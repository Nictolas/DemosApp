import { beforeEach, describe, expect, it } from 'vitest';
import { clearLocalOpinionVector, LOCAL_OPINION_VAULT_STORAGE_KEY, readLocalOpinionVector, validateLocalOpinionVector, writeLocalOpinionVector } from './localOpinionVault';

describe('localOpinionVault', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips an opinion vector only through device storage', () => {
    writeLocalOpinionVector({ q1: 2, q2: 'A' });
    expect(readLocalOpinionVector()).toEqual({ q1: 2, q2: 'A' });
    expect(localStorage.getItem(LOCAL_OPINION_VAULT_STORAGE_KEY)).toContain('"q1":2');
  });

  it('fails closed when missing or malformed', () => {
    expect(() => readLocalOpinionVector()).toThrow(/missing/);
    localStorage.setItem(LOCAL_OPINION_VAULT_STORAGE_KEY, '{bad');
    expect(() => readLocalOpinionVector()).toThrow();
    expect(() => validateLocalOpinionVector({ q1: { nested: true } })).toThrow(/answer/);
  });

  it('clears device copy explicitly', () => {
    writeLocalOpinionVector({ q1: true });
    clearLocalOpinionVector();
    expect(() => readLocalOpinionVector()).toThrow(/missing/);
  });
});
