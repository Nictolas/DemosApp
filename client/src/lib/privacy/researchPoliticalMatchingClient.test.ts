import { describe, expect, it, vi } from 'vitest';
import { fetchPoliticalVectorsForLocalMatch } from './researchPoliticalMatchingClient';

describe('researchPoliticalMatchingClient privacy boundary', () => {
  it('sends only scope and omits credentials', async () => {
    vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING', 'true');
    vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL', 'https://research.example');
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.credentials).toBe('omit');
      const body = JSON.parse(String(init?.body));
      expect(Object.keys(body)).toEqual(['scope']);
      expect(JSON.stringify(body)).not.toMatch(/userId|citizenOpinions|opinionVector|authorization/i);
      return new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    });
    await fetchPoliticalVectorsForLocalMatch({ kind: 'representative', grade: 'E' }, fetchMock as typeof fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });

  it('fails closed when feature flag is off', async () => {
    vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING', 'false');
    vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL', 'https://research.example');
    const fetchMock = vi.fn();
    await expect(fetchPoliticalVectorsForLocalMatch({ kind: 'candidate', grade: 'E' }, fetchMock as typeof fetch)).rejects.toThrow(/disabled/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
