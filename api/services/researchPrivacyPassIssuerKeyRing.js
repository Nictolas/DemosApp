const crypto = require('crypto');
const {
  createResearchIssuerPublicKeyRing
} = require('./researchIssuerPublicKeyRing');

const MAX_PRIVACY_PASS_RING_ENTRIES = 16;
const MAX_SERIALIZED_PUBLIC_KEY_BYTES = 4096;

const normalizeSerializedPublicKey = (value) => {
  if (!Buffer.isBuffer(value) && !ArrayBuffer.isView(value)) {
    throw new Error('Privacy Pass public-key serialization must return binary data');
  }
  const bytes = Buffer.from(value);
  if (bytes.length === 0 || bytes.length > MAX_SERIALIZED_PUBLIC_KEY_BYTES) {
    throw new Error('Invalid Privacy Pass serialized public-key size');
  }
  return bytes;
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

const createResearchPrivacyPassIssuerKeyRing = async ({
  privacyPass,
  entries
}) => {
  const getPublicKeyBytes = privacyPass?.publicVerif?.getPublicKeyBytes;
  if (typeof getPublicKeyBytes !== 'function') {
    throw new Error('Privacy Pass public-key serialization API is required');
  }
  if (
    !Array.isArray(entries) ||
    entries.length === 0 ||
    entries.length > MAX_PRIVACY_PASS_RING_ENTRIES
  ) {
    throw new Error('Privacy Pass issuer key-ring entries are invalid');
  }

  const keys = await Promise.all(entries.map(async ({ publicKey, epochs }) => {
    const publicKeyBytes = normalizeSerializedPublicKey(
      await getPublicKeyBytes(publicKey)
    );
    return {
      keyId: sha256(publicKeyBytes),
      publicKey,
      epochs
    };
  }));

  return createResearchIssuerPublicKeyRing({ keys });
};

module.exports = {
  createResearchPrivacyPassIssuerKeyRing
};
