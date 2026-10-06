export const SECURE_OPINION_KEY_CRYPTO_REQUIREMENTS = Object.freeze({
  nativePlatform: 'android',
  keystoreBacked: true,
  authenticatedEncryption: true,
  allowedCipherFamilies: Object.freeze(['AES-GCM']),
  browserFallbackAllowed: false,
  legacyRsaPkcs1StorageAllowed: false
});

export const assertSecureOpinionKeyCapabilities = (capabilities: {
  nativePlatform: string;
  keystoreBacked: boolean;
  cipherFamily: string;
  browserFallback: boolean;
  legacyRsaPkcs1Storage: boolean;
}): void => {
  if (
    capabilities.nativePlatform !== 'android' ||
    !capabilities.keystoreBacked ||
    !SECURE_OPINION_KEY_CRYPTO_REQUIREMENTS.allowedCipherFamilies.includes(capabilities.cipherFamily) ||
    capabilities.browserFallback ||
    capabilities.legacyRsaPkcs1Storage
  ) throw new Error('Secure opinion key capabilities rejected');
};
