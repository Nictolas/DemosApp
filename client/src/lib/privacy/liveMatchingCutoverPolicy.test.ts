import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLivePoliticalMatchingRuntimeMode } from './liveMatchingCutoverPolicy';

afterEach(()=>vi.unstubAllEnvs());

describe('liveMatchingCutoverPolicy',()=>{
  it('keeps the live app on legacy when vault cutover is absent',()=>{
    vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING','true');
    vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL','https://research.example');
    vi.stubEnv('VITE_PRIVACY_OPINION_VAULT_CUTOVER','');
    expect(getLivePoliticalMatchingRuntimeMode()).toEqual({
      mode:'legacy',
      vaultPolicy:{mode:'off',allowVaultRead:false,allowLegacyImport:false}
    });
  });
  it('requires both local Research matching and explicit vault cutover',()=>{
    vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING','true');
    vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL','https://research.example');
    vi.stubEnv('VITE_PRIVACY_OPINION_VAULT_CUTOVER','vault-only');
    expect(getLivePoliticalMatchingRuntimeMode().mode).toBe('privacy-first');
  });
  it('does not enable privacy-first with a vault flag but no Research endpoint',()=>{
    vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING','true');
    vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL','');
    vi.stubEnv('VITE_PRIVACY_OPINION_VAULT_CUTOVER','bootstrap');
    expect(getLivePoliticalMatchingRuntimeMode().mode).toBe('legacy');
  });
});
