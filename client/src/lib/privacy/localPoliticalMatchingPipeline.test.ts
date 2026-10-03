import { describe, expect, it, vi } from 'vitest';
import { runLocalPoliticalMatchingPipeline } from './localPoliticalMatchingPipeline';

describe('localPoliticalMatchingPipeline privacy invariant',()=>{
  it('never sends the citizen opinion vector to Research',async()=>{
    vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING','true');
    vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL','https://research.example');
    const privateVector={private_q_1:2,private_q_2:1};
    const source={read:vi.fn(async()=>({source:'vault' as const,vector:privateVector}))};
    const fetchMock=vi.fn(async(_url:string,init?:RequestInit)=>{
      const serialized=String(init?.body);
      expect(serialized).not.toContain('private_q_1');
      expect(serialized).not.toContain('private_q_2');
      expect(init?.credentials).toBe('omit');
      return new Response(JSON.stringify({candidates:[{
        candidateId:'candidate-1',displayName:'Candidate',avatarConfig:null,
        opinions:{private_q_1:2,private_q_2:0}
      }]}),{status:200});
    });
    const result=await runLocalPoliticalMatchingPipeline({
      source,scope:{kind:'candidate',grade:'E',country:'IT'},fetchImpl:fetchMock as typeof fetch
    });
    expect(result).toEqual([{candidate:{id:'candidate-1',nome:'Candidate',avatar_config:null},commonOpinions:1,comparedOpinions:2}]);
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });

  it('does not contact Research when the private vector source fails',async()=>{
    vi.stubEnv('VITE_PRIVACY_LOCAL_POLITICAL_MATCHING','true');
    vi.stubEnv('VITE_RESEARCH_PUBLIC_BASE_URL','https://research.example');
    const source={read:vi.fn(async()=>{throw new Error('vault unavailable')})};
    const fetchMock=vi.fn();
    await expect(runLocalPoliticalMatchingPipeline({
      source,scope:{kind:'representative',grade:'E'},fetchImpl:fetchMock as typeof fetch
    })).rejects.toThrow(/vault unavailable/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
