import { describe, expect, it } from 'vitest';
import { createSecureBridgeOpinionKeyProvider, createUnavailableOpinionKeyProvider } from './deviceOpinionKeyProvider';

describe('deviceOpinionKeyProvider', () => {
  it('fails closed when no secure platform bridge exists', async () => {
    await expect(createUnavailableOpinionKeyProvider().getOrCreateKey()).rejects.toThrow(/unavailable/);
  });

  it('stores only raw key material through the injected secure bridge and imports non-extractable CryptoKey', async () => {
    const store = new Map<string,string>();
    const bridge = {
      async isAvailable(){ return true; },
      async get(name:string){ return store.get(name) ?? null; },
      async set(name:string,value:string){ store.set(name,value); },
      async remove(name:string){ store.delete(name); }
    };
    const provider=createSecureBridgeOpinionKeyProvider(bridge);
    const first=await provider.getOrCreateKey();
    const second=await provider.getExistingKey();
    expect(first.extractable).toBe(false);
    expect(second?.extractable).toBe(false);
    expect(store.size).toBe(1);
    await provider.clearKey();
    expect(store.size).toBe(0);
  });

  it('refuses to downgrade to browser storage when bridge reports unavailable', async () => {
    const bridge={async isAvailable(){return false;},async get(){return null;},async set(){throw new Error('must not write');},async remove(){}};
    await expect(createSecureBridgeOpinionKeyProvider(bridge).getOrCreateKey()).rejects.toThrow(/unavailable/);
  });
});
