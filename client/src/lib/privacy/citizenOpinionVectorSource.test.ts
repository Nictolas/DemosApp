import { describe, expect, it, vi } from 'vitest';
import { createCitizenOpinionVectorSource } from './citizenOpinionVectorSource';

describe('citizenOpinionVectorSource', () => {
  it('keeps matching consumers independent from the legacy API shape', async () => {
    const vault={read:vi.fn(async()=>({q1:2})),write:vi.fn(async()=>{})};
    const fetchLegacyOpinions=vi.fn(async()=>({q1:1}));
    const source=createCitizenOpinionVectorSource({
      vault,
      policy:{mode:'vault-only',allowVaultRead:true,allowLegacyImport:false},
      fetchLegacyOpinions
    });
    expect(await source.read()).toEqual({source:'vault',vector:{q1:2}});
    expect(fetchLegacyOpinions).not.toHaveBeenCalled();
  });

  it('permits the legacy fetcher only during explicit bootstrap', async () => {
    const vault={read:vi.fn(async()=>{throw new Error('missing')}),write:vi.fn(async()=>{})};
    const fetchLegacyOpinions=vi.fn(async()=>({q1:1}));
    const source=createCitizenOpinionVectorSource({
      vault,
      policy:{mode:'bootstrap',allowVaultRead:true,allowLegacyImport:true},
      fetchLegacyOpinions
    });
    expect(await source.read()).toEqual({source:'legacy-import',vector:{q1:1}});
    expect(fetchLegacyOpinions).toHaveBeenCalledTimes(1);
    expect(vault.write).toHaveBeenCalledWith({q1:1});
  });

  it('cannot access either source when cutover is off', async () => {
    const vault={read:vi.fn(async()=>({q1:2})),write:vi.fn(async()=>{})};
    const fetchLegacyOpinions=vi.fn(async()=>({q1:1}));
    const source=createCitizenOpinionVectorSource({
      vault,
      policy:{mode:'off',allowVaultRead:false,allowLegacyImport:false},
      fetchLegacyOpinions
    });
    await expect(source.read()).rejects.toThrow(/cutover disabled/);
    expect(vault.read).not.toHaveBeenCalled();
    expect(fetchLegacyOpinions).not.toHaveBeenCalled();
  });
});
