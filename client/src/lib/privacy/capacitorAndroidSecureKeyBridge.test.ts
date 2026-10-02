import { describe, expect, it, vi } from 'vitest';
import { createCapacitorAndroidSecureKeyBridge } from './capacitorAndroidSecureKeyBridge';

const android={isNativePlatform:()=>true,getPlatform:()=> 'android'};
describe('capacitorAndroidSecureKeyBridge',()=>{
  it('delegates only on native Android',async()=>{
    const plugin={get:vi.fn(async()=>({value:'secret'})),set:vi.fn(async()=>{}),remove:vi.fn(async()=>{})};
    const bridge=createCapacitorAndroidSecureKeyBridge({runtime:android,plugin});
    expect(await bridge.isAvailable()).toBe(true);
    expect(await bridge.get('k')).toBe('secret');
    await bridge.set('k','v'); await bridge.remove('k');
    expect(plugin.set).toHaveBeenCalledWith('k','v');
  });
  it('never calls plugin on web',async()=>{
    const plugin={get:vi.fn(),set:vi.fn(),remove:vi.fn()};
    const bridge=createCapacitorAndroidSecureKeyBridge({runtime:{isNativePlatform:()=>false,getPlatform:()=> 'web'},plugin});
    expect(await bridge.isAvailable()).toBe(false);
    await expect(bridge.get('k')).rejects.toThrow(/native Android/);
    expect(plugin.get).not.toHaveBeenCalled();
  });
  it('fails on unexpected plugin payloads',async()=>{
    const plugin={get:vi.fn(async()=>({bad:true})),set:vi.fn(async()=>{}),remove:vi.fn(async()=>{})};
    await expect(createCapacitorAndroidSecureKeyBridge({runtime:android,plugin}).get('k')).rejects.toThrow(/Unexpected/);
  });
});
