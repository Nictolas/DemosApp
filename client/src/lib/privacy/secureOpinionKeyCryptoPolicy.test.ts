import { describe, expect, it } from 'vitest';
import { assertSecureOpinionKeyCapabilities } from './secureOpinionKeyCryptoPolicy';

describe('secure opinion key crypto policy', () => {
  const approved={nativePlatform:'android',keystoreBacked:true,cipherFamily:'AES-GCM',browserFallback:false,legacyRsaPkcs1Storage:false};
  it('accepts the target Android Keystore + AES-GCM profile',()=>expect(()=>assertSecureOpinionKeyCapabilities(approved)).not.toThrow());
  it.each([
    {...approved,nativePlatform:'web'},
    {...approved,keystoreBacked:false},
    {...approved,cipherFamily:'RSA/ECB/PKCS1Padding'},
    {...approved,browserFallback:true},
    {...approved,legacyRsaPkcs1Storage:true}
  ])('rejects insecure/downgraded capability profiles',(candidate)=>expect(()=>assertSecureOpinionKeyCapabilities(candidate)).toThrow(/rejected/));
});
