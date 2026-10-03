import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertLivePrivacyStartupReady } from './livePrivacyStartupGuard';
import { installLivePoliticalMatchingSource, resetLivePoliticalMatchingSourceForTests } from './livePoliticalMatchingSource';

afterEach(()=>{resetLivePoliticalMatchingSourceForTests();vi.unstubAllEnvs()});
const enablePrivacy=()=>{vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING','true');vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL','https://research.example');vi.stubEnv('VITE_PRIVACY_OPINION_VAULT_CUTOVER','vault-only')};
describe('livePrivacyStartupGuard',()=>{
 it('allows default legacy startup without a source',()=>{vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING','false');vi.stubEnv('VITE_PRIVACY_OPINION_VAULT_CUTOVER','off');expect(()=>assertLivePrivacyStartupReady()).not.toThrow()});
 it('blocks privacy-first startup without a secure source',()=>{enablePrivacy();expect(()=>assertLivePrivacyStartupReady()).toThrow(/startup blocked/)});
 it('allows privacy-first only after explicit source install',()=>{enablePrivacy();installLivePoliticalMatchingSource({read:async()=>({source:'vault',vector:{q1:2}})});expect(()=>assertLivePrivacyStartupReady()).not.toThrow()});
});
