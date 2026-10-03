import { describe, expect, it, vi } from 'vitest';
import { createNativeAndroidCitizenOpinionVectorSource, createNativeAndroidCitizenOpinionVectorSourceFromIdentity } from './citizenOpinionVectorSourceFactory';

const memoryStorage=():Storage=>{
  const values=new Map<string,string>();
  return {
    get length(){return values.size},
    clear:()=>values.clear(),
    getItem:(k)=>values.get(k)??null,
    key:(i)=>[...values.keys()][i]??null,
    removeItem:(k)=>{values.delete(k)},
    setItem:(k,v)=>{values.set(k,v)}
  };
};
const android={isNativePlatform:()=>true,getPlatform:()=> 'android'};

describe('citizenOpinionVectorSourceFactory',()=>{
  it('composes native Android secure storage without importing a concrete plugin',async()=>{
    const secureValues=new Map<string,string>();
    const secureStorage={
      get:vi.fn(async(k:string)=>secureValues.get(k)??null),
      set:vi.fn(async(k:string,v:string)=>{secureValues.set(k,v)}),
      remove:vi.fn(async(k:string)=>secureValues.delete(k))
    };
    const fetchLegacyOpinions=vi.fn(async()=>({q1:2}));
    const source=createNativeAndroidCitizenOpinionVectorSource({
      runtime:android,secureStorage,storage:memoryStorage(),
      policy:{mode:'bootstrap',allowVaultRead:true,allowLegacyImport:true},
      fetchLegacyOpinions
    });
    expect(await source.read()).toEqual({source:'legacy-import',vector:{q1:2}});
    expect(fetchLegacyOpinions).toHaveBeenCalledTimes(1);
    expect(secureStorage.set).toHaveBeenCalledTimes(1);
  });

  it('fails closed before touching secure storage when cutover is off',async()=>{
    const secureStorage={get:vi.fn(async()=>null),set:vi.fn(async()=>{}),remove:vi.fn(async()=>true)};
    const fetchLegacyOpinions=vi.fn(async()=>({q1:2}));
    const source=createNativeAndroidCitizenOpinionVectorSource({
      runtime:android,secureStorage,storage:memoryStorage(),
      policy:{mode:'off',allowVaultRead:false,allowLegacyImport:false},
      fetchLegacyOpinions
    });
    await expect(source.read()).rejects.toThrow(/cutover disabled/);
    expect(secureStorage.get).not.toHaveBeenCalled();
    expect(fetchLegacyOpinions).not.toHaveBeenCalled();
  });
  it('binds bootstrap to the minimized authenticated own-profile adapter',async()=>{
    const secureValues=new Map<string,string>();
    const secureStorage={
      get:vi.fn(async(k:string)=>secureValues.get(k)??null),
      set:vi.fn(async(k:string,v:string)=>{secureValues.set(k,v)}),
      remove:vi.fn(async(k:string)=>secureValues.delete(k))
    };
    const identityRequest=vi.fn(async()=>({ok:true,data:{data:{userAnswers:{q1:2},email:'person@example.test'},token:'secret'}}));
    const source=createNativeAndroidCitizenOpinionVectorSourceFromIdentity({
      runtime:android,secureStorage,storage:memoryStorage(),
      policy:{mode:'bootstrap',allowVaultRead:true,allowLegacyImport:true},
      identityRequest
    });
    expect(await source.read()).toEqual({source:'legacy-import',vector:{q1:2}});
    expect(identityRequest).toHaveBeenCalledWith('GET','/api/opinioni/profile');
    expect(identityRequest).toHaveBeenCalledTimes(1);
  });

});
