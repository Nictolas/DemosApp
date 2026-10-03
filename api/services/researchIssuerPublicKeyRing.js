const crypto = require('crypto');
const { validateCredentialContext } = require('./credentialContextPolicy');

const KEY_ID_BYTES = 32;
const MAX_KEYS_PER_EPOCH = 2;
const MAX_EPOCHS_PER_KEY = 8;
const FORBIDDEN_KEY_CAPABILITIES = Object.freeze([
  'privateKey',
  'sign',
  'issue',
  'blindSign',
  'exportKey',
  'getPrivateKey'
]);

const normalizeKeyId = (value) => {
  const keyId = Buffer.from(value || []);
  if (keyId.length !== KEY_ID_BYTES) {
    throw new Error('Invalid Research issuer public key id');
  }
  return keyId;
};

const assertVerificationOnlyPublicKey = (publicKey) => {
  if (!publicKey || typeof publicKey !== 'object') {
    throw new Error('Research issuer public key is required');
  }
  if (publicKey.type && publicKey.type !== 'public') {
    throw new Error('Research issuer key must be public');
  }
  if (
    Array.isArray(publicKey.usages) &&
    publicKey.usages.some((usage) => usage !== 'verify')
  ) {
    throw new Error('Research issuer key exposes non-verification usage');
  }
  for (const capability of FORBIDDEN_KEY_CAPABILITIES) {
    if (capability in publicKey) {
      throw new Error('Research issuer key exposes forbidden private capability');
    }
  }
  return publicKey;
};

const validateEpochs = (epochs) => {
  if (!Array.isArray(epochs) || epochs.length === 0 || epochs.length > MAX_EPOCHS_PER_KEY) {
    throw new Error('Invalid Research issuer key epoch scope');
  }
  const unique = new Set();
  for (const epoch of epochs) {
    validateCredentialContext({ purpose: 'renew', epoch });
    if (unique.has(epoch)) {
      throw new Error('Duplicate Research issuer key epoch');
    }
    unique.add(epoch);
  }
  return unique;
};

const timingSafeKeyIdEqual = (left, right) => {
  const a = normalizeKeyId(left);
  const b = normalizeKeyId(right);
  return crypto.timingSafeEqual(a, b);
};

const createResearchIssuerPublicKeyRing = ({ keys }) => {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('Research issuer public key ring requires keys');
  }

  const seenKeyIds = new Set();
  const epochCounts = new Map();
  const normalizedKeys = keys.map(({ keyId, publicKey, epochs }) => {
    const normalizedKeyId = normalizeKeyId(keyId);
    const keyIdHex = normalizedKeyId.toString('hex');
    if (seenKeyIds.has(keyIdHex)) {
      throw new Error('Duplicate Research issuer public key id');
    }
    seenKeyIds.add(keyIdHex);

    const epochScope = validateEpochs(epochs);
    for (const epoch of epochScope) {
      const count = (epochCounts.get(epoch) || 0) + 1;
      if (count > MAX_KEYS_PER_EPOCH) {
        throw new Error('Too many Research issuer keys active for one epoch');
      }
      epochCounts.set(epoch, count);
    }

    return Object.freeze({
      keyId: normalizedKeyId,
      publicKey: assertVerificationOnlyPublicKey(publicKey),
      epochs: epochScope
    });
  });

  return Object.freeze({
    resolve({ tokenKeyId, epoch }) {
      validateCredentialContext({ purpose: 'renew', epoch });
      let wanted;
      try {
        wanted = normalizeKeyId(tokenKeyId);
      } catch {
        return null;
      }

      const matches = normalizedKeys.filter((entry) =>
        entry.epochs.has(epoch) && timingSafeKeyIdEqual(entry.keyId, wanted)
      );

      return matches.length === 1 ? matches[0].publicKey : null;
    },
    activeKeyCount(epoch) {
      validateCredentialContext({ purpose: 'renew', epoch });
      return epochCounts.get(epoch) || 0;
    }
  });
};

module.exports = {
  KEY_ID_BYTES,
  MAX_KEYS_PER_EPOCH,
  MAX_EPOCHS_PER_KEY,
  FORBIDDEN_KEY_CAPABILITIES,
  normalizeKeyId,
  assertVerificationOnlyPublicKey,
  createResearchIssuerPublicKeyRing
};
