import { afterEach, describe, expect, it } from 'vitest';
import { getLivePoliticalMatchingSource, installLivePoliticalMatchingSource, resetLivePoliticalMatchingSourceForTests } from './livePoliticalMatchingSource';

afterEach(()=>resetLivePoliticalMatchingSourceForTests());

describe('livePoliticalMatchingSource',()=>{
  it('fails closed until a source is explicitly installed',()=>{
    expect(()=>getLivePoliticalMatchingSource()).toThrow(/unavailable/);
  });
  it('returns the explicitly installed local source',()=>{
    const source={read:async()=>({source:'vault' as const,vector:{q1:2}})};
    installLivePoliticalMatchingSource(source);
    expect(getLivePoliticalMatchingSource()).toBe(source);
  });
  it('rejects source replacement to avoid runtime downgrade or swapping',()=>{
    installLivePoliticalMatchingSource({read:async()=>({source:'vault' as const,vector:{q1:2}})});
    expect(()=>installLivePoliticalMatchingSource({read:async()=>({source:'legacy-import' as const,vector:{q1:1}})})).toThrow(/already installed/);
  });
});
