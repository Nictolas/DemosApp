const crypto = require('crypto');
const {
  createResearchIssuerPublicKeyRing
} = require('./researchIssuerPublicKeyRing');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

const createResearchPrivacyPassIssuerKeyRing = async ({
  privacyPass,
  entries
}) => {
  const getPublicKeyBytes = privacyPass?.publicVerif?.getPublicKeyBytes;
  if (typeof getPublicKeyBytes !== 'function') {
    throw new Error('Privacy Pass public-key serialization API is required');
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Privacy Pass issuer key-ring entries are required');
  }

  const keys = await Promise.all(entries.map(async ({ publicKey, epochs }) => {
    const publicKeyBytes = await getPublicKeyBytes(publicKey);
    return {
      keyId: sha256(Buffer.from(publicKeyBytes)),
      publicKey,
      epochs
    };
  }));

  return createResearchIssuerPublicKeyRing({ keys });
};

module.exports = {
  createResearchPrivacyPassIssuerKeyRing
};
