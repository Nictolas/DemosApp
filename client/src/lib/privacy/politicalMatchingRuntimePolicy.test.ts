import { describe, expect, it } from 'vitest';
import { assertNoPrivacyFallback, resolvePoliticalMatchingRuntimeMode } from './politicalMatchingRuntimePolicy';

describe('politicalMatchingRuntimePolicy',()=>{
  it('keeps legacy as the default until both privacy gates are active',()=>{
    expect(resolvePoliticalMatchingRuntimeMode({localMatchingEnabled:false,vaultCutoverMode:'off'})).toBe('legacy');
    expect(resolvePoliticalMatchingRuntimeMode({localMatchingEnabled:true,vaultCutoverMode:'off'})).toBe('legacy');
    expect(resolvePoliticalMatchingRuntimeMode({localMatchingEnabled:false,vaultCutoverMode:'bootstrap'})).toBe('legacy');
  });
  it('selects privacy-first only with local matching plus an explicit vault phase',()=>{
    expect(resolvePoliticalMatchingRuntimeMode({localMatchingEnabled:true,vaultCutoverMode:'bootstrap'})).toBe('privacy-first');
    expect(resolvePoliticalMatchingRuntimeMode({localMatchingEnabled:true,vaultCutoverMode:'vault-only'})).toBe('privacy-first');
  });
  it('never converts a privacy-first failure into a legacy fallback',()=>{
    const original=new Error('vault unavailable');
    expect(()=>assertNoPrivacyFallback('privacy-first',original)).toThrow(original);
  });
});
