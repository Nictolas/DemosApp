const crypto = require('crypto');
const {
  assertVerificationOnlyPublicKey
} = require('./researchIssuerPublicKeyRing');

const MIN_PUBLIC_KEY_BYTES = 64;
const MAX_PUBLIC_KEY_BYTES = 4096;
const EXPECTED_ALGORITHM = 'RSA-PSS';
const EXPECTED_HASH = 'SHA-384';

const normalizeAlgorithm = (rsaParams) => {
  const hash = typeof rsaParams?.hash === 'string'
    ? rsaParams.hash
    : rsaParams?.hash?.name;
  if (rsaParams?.name !== EXPECTED_ALGORITHM || hash !== EXPECTED_HASH) {
    throw new Error('Unexpected Privacy Pass public-key algorithm');
  }
  return Object.freeze({ name: EXPECTED_ALGORITHM, hash: EXPECTED_HASH });
};

const createResearchPrivacyPassPublicKeyLoader = ({
  privacyPass,
  subtle = crypto.webcrypto?.subtle
} = {}) => {
  const publicVerif = privacyPass?.publicVerif;
  const convertToEncryptionSpki = publicVerif?.convertRSASSAPSSToEnc;
  if (typeof convertToEncryptionSpki !== 'function') {
    throw new Error('Privacy Pass RSA-PSS public-key conversion API is required');
  }
  if (typeof subtle?.importKey !== 'function') {
    throw new Error('WebCrypto public-key import API is required');
  }
  const algorithm = normalizeAlgorithm(publicVerif?.BLIND_RSA?.rsaParams);

  return async (publicKeyBytes) => {
    if (!Buffer.isBuffer(publicKeyBytes) && !ArrayBuffer.isView(publicKeyBytes)) {
      throw new Error('Invalid Privacy Pass issuer public-key bytes');
    }
    const material = Buffer.from(publicKeyBytes);
    if (
      material.length < MIN_PUBLIC_KEY_BYTES ||
      material.length > MAX_PUBLIC_KEY_BYTES
    ) {
      throw new Error('Invalid Privacy Pass issuer public-key bytes');
    }

    let spki;
    try {
      spki = Buffer.from(convertToEncryptionSpki(new Uint8Array(material)));
    } catch {
      throw new Error('Invalid Privacy Pass issuer public-key encoding');
    }
    if (spki.length < MIN_PUBLIC_KEY_BYTES || spki.length > MAX_PUBLIC_KEY_BYTES) {
      throw new Error('Invalid Privacy Pass issuer SPKI encoding');
    }

    let publicKey;
    try {
      publicKey = await subtle.importKey(
        'spki',
        new Uint8Array(spki),
        algorithm,
        false,
        ['verify']
      );
    } catch {
      throw new Error('Privacy Pass issuer public key could not be imported');
    }

    const verifiedKey = assertVerificationOnlyPublicKey(publicKey);
    let importedAlgorithm;
    let hashName;
    try {
      importedAlgorithm = verifiedKey.algorithm;
      hashName = typeof importedAlgorithm?.hash === 'string'
        ? importedAlgorithm.hash
        : importedAlgorithm?.hash?.name;
    } catch {
      throw new Error('Imported Privacy Pass issuer key algorithm inspection failed');
    }
    if (
      importedAlgorithm?.name &&
      (importedAlgorithm.name !== EXPECTED_ALGORITHM || hashName !== EXPECTED_HASH)
    ) {
      throw new Error('Imported Privacy Pass issuer key uses unexpected algorithm');
    }
    return verifiedKey;
  };
};

module.exports = {
  MIN_PUBLIC_KEY_BYTES,
  MAX_PUBLIC_KEY_BYTES,
  EXPECTED_ALGORITHM,
  EXPECTED_HASH,
  createResearchPrivacyPassPublicKeyLoader
};
