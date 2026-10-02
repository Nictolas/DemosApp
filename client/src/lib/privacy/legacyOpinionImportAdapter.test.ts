import { describe, expect, it, vi } from 'vitest';
import { createLegacyOwnOpinionFetcher, extractLegacyOwnOpinionVector } from './legacyOpinionImportAdapter';

describe('legacyOpinionImportAdapter',()=>{
  it('extracts only the own opinion vector and drops surrounding identity/profile data',()=>{
    const result=extractLegacyOwnOpinionVector({
      ok:true,
      data:{data:{userAnswers:{q1:2,q2:1},email:'person@example.test',nome:'Person'},token:'secret'}
    });
    expect(result).toEqual({q1:2,q2:1});
    expect(Object.keys(result)).toEqual(['q1','q2']);
  });

  it('rejects malformed or invalid opinion vectors',()=>{
    expect(()=>extractLegacyOwnOpinionVector({ok:false,data:{}})).toThrow();
    expect(()=>extractLegacyOwnOpinionVector({ok:true,data:{data:{userAnswers:{q1:{nested:true}}}}})).toThrow(/Invalid opinion answer/);
  });

  it('uses only the authenticated own-profile endpoint',async()=>{
    const request=vi.fn(async()=>({ok:true,data:{data:{userAnswers:{q1:2}}}}));
    const fetchOwn=createLegacyOwnOpinionFetcher(request);
    expect(await fetchOwn()).toEqual({q1:2});
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('GET','/api/opinioni/profile');
  });
});
