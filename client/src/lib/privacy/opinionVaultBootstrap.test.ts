import { describe, expect, it, vi } from 'vitest';
import { readOrBootstrapOpinionVault } from './opinionVaultBootstrap';

describe('opinionVaultBootstrap', () => {
  it('uses the encrypted vault without contacting legacy Identity when available', async () => {
    const vector={q1:2};
    const vault={read:vi.fn(async()=>vector),write:vi.fn(async()=>{})};
    const fetchLegacyOpinions=vi.fn(async()=>({q1:1}));
    const result=await readOrBootstrapOpinionVault({vault,fetchLegacyOpinions,policy:{mode:'bootstrap',allowVaultRead:true,allowLegacyImport:true}});
    expect(result).toEqual({source:'vault',vector});
    expect(fetchLegacyOpinions).not.toHaveBeenCalled();
    expect(vault.write).not.toHaveBeenCalled();
  });

  it('fails closed when vault is unavailable and migration import is disabled', async () => {
    const vault={read:vi.fn(async()=>{throw new Error('missing')}),write:vi.fn(async()=>{})};
    const fetchLegacyOpinions=vi.fn(async()=>({q1:2}));
    await expect(readOrBootstrapOpinionVault({vault,fetchLegacyOpinions,policy:{mode:'vault-only',allowVaultRead:true,allowLegacyImport:false}})).rejects.toThrow('missing');
    expect(fetchLegacyOpinions).not.toHaveBeenCalled();
  });

  it('imports once only when explicitly enabled, then writes before returning', async () => {
    const calls:string[]=[];
    const vector={q1:2};
    const vault={read:vi.fn(async()=>{throw new Error('missing')}),write:vi.fn(async(v)=>{calls.push('write');expect(v).toEqual(vector)})};
    const fetchLegacyOpinions=vi.fn(async()=>{calls.push('fetch');return vector});
    const result=await readOrBootstrapOpinionVault({vault,fetchLegacyOpinions,policy:{mode:'bootstrap',allowVaultRead:true,allowLegacyImport:true}});
    expect(result).toEqual({source:'legacy-import',vector});
    expect(calls).toEqual(['fetch','write']);
  });

  it('never deletes or mutates legacy server data', async () => {
    const source={q1:2};
    const vault={read:vi.fn(async()=>{throw new Error('missing')}),write:vi.fn(async()=>{})};
    const fetchLegacyOpinions=vi.fn(async()=>({...source}));
    await readOrBootstrapOpinionVault({vault,fetchLegacyOpinions,policy:{mode:'bootstrap',allowVaultRead:true,allowLegacyImport:true}});
    expect(source).toEqual({q1:2});
    expect(fetchLegacyOpinions).toHaveBeenCalledTimes(1);
  });
  it('does not even read the vault while cutover is off', async () => {
    const vault={read:vi.fn(async()=>({q1:2})),write:vi.fn(async()=>{})};
    const fetchLegacyOpinions=vi.fn(async()=>({q1:2}));
    await expect(readOrBootstrapOpinionVault({vault,fetchLegacyOpinions,policy:{mode:'off',allowVaultRead:false,allowLegacyImport:false}})).rejects.toThrow(/cutover disabled/);
    expect(vault.read).not.toHaveBeenCalled();
    expect(fetchLegacyOpinions).not.toHaveBeenCalled();
  });

});
