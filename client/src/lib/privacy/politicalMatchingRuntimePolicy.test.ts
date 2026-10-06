import { describe, expect, it, vi } from 'vitest';
import { assertNoPrivacyFallback, resolvePoliticalMatchingRuntimeMode, runPoliticalMatchingRuntime } from './politicalMatchingRuntimePolicy';

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
  it('executes exactly one path and never falls back after privacy-first selection',async()=>{
    const legacy=vi.fn(async()=>['legacy']);
    const privacy=vi.fn(async()=>{throw new Error('vault failed')});
    await expect(runPoliticalMatchingRuntime({mode:'privacy-first',runLegacy:legacy,runPrivacyFirst:privacy})).rejects.toThrow(/vault failed/);
    expect(privacy).toHaveBeenCalledTimes(1);
    expect(legacy).not.toHaveBeenCalled();
  });
  it('uses only legacy while runtime mode remains legacy',async()=>{
    const legacy=vi.fn(async()=>['legacy']);
    const privacy=vi.fn(async()=>['privacy']);
    expect(await runPoliticalMatchingRuntime({mode:'legacy',runLegacy:legacy,runPrivacyFirst:privacy})).toEqual(['legacy']);
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(privacy).not.toHaveBeenCalled();
  });

});
