const crypto = require('crypto');
const {
  createResearchIssuerPublicKeyRing,
  assertVerificationOnlyPublicKey
} = require('./researchIssuerPublicKeyRing');

const KEYSET_SIGNATURE_DOMAIN = 'demos.research.issuer-keyset.v1';
const KEYSET_SCHEMA_VERSION = 1;
const MAX_KEYS_PER_SNAPSHOT = 16;
const MAX_SNAPSHOT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MIN_PUBLIC_KEY_BYTES = 64;
const MAX_PUBLIC_KEY_BYTES = 4096;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const decodeCanonicalBase64Url = (value, { minBytes, maxBytes, label }) => {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  const decoded = Buffer.from(value, 'base64url');
  if (
    decoded.length < minBytes ||
    decoded.length > maxBytes ||
    decoded.toString('base64url') !== value
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return decoded;
};

const assertExactKeys = (value, expected, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new Error(`Invalid ${label}`);
  }
};

const normalizePayload = (payload) => {
  assertExactKeys(payload, ['version', 'sequence', 'issuedAt', 'expiresAt', 'keys'], 'issuer key-set payload');
  if (payload.version !== KEYSET_SCHEMA_VERSION) {
    throw new Error('Unsupported issuer key-set version');
  }
  if (!Number.isSafeInteger(payload.sequence) || payload.sequence < 1) {
    throw new Error('Invalid issuer key-set sequence');
  }
  if (!Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)) {
    throw new Error('Invalid issuer key-set validity window');
  }
  if (
    payload.expiresAt <= payload.issuedAt ||
    payload.expiresAt - payload.issuedAt > MAX_SNAPSHOT_VALIDITY_MS
  ) {
    throw new Error('Invalid issuer key-set validity window');
  }
  if (!Array.isArray(payload.keys) || payload.keys.length === 0 || payload.keys.length > MAX_KEYS_PER_SNAPSHOT) {
    throw new Error('Invalid issuer key-set keys');
  }

  const seenIds = new Set();
  const keys = payload.keys.map((entry) => {
    assertExactKeys(entry, ['tokenKeyId', 'publicKey', 'epochs'], 'issuer key-set entry');
    const tokenKeyId = decodeCanonicalBase64Url(entry.tokenKeyId, {
      minBytes: 32,
      maxBytes: 32,
      label: 'issuer token key id'
    });
    const publicKeyBytes = decodeCanonicalBase64Url(entry.publicKey, {
      minBytes: MIN_PUBLIC_KEY_BYTES,
      maxBytes: MAX_PUBLIC_KEY_BYTES,
      label: 'issuer public key'
    });
    const expectedKeyId = crypto.createHash('sha256').update(publicKeyBytes).digest();
    if (!crypto.timingSafeEqual(tokenKeyId, expectedKeyId)) {
      throw new Error('Issuer token key id does not match public key');
    }
    const tokenKeyIdText = tokenKeyId.toString('base64url');
    if (seenIds.has(tokenKeyIdText)) {
      throw new Error('Duplicate issuer token key id');
    }
    seenIds.add(tokenKeyIdText);
    if (!Array.isArray(entry.epochs) || entry.epochs.length === 0) {
      throw new Error('Invalid issuer key epoch scope');
    }
    const normalizedEpochs = entry.epochs.map((epoch) => {
      if (
        typeof epoch !== 'string' ||
        epoch.length === 0 ||
        epoch.length > 64 ||
        !/^[A-Za-z0-9._:-]+$/.test(epoch)
      ) {
        throw new Error('Invalid issuer key epoch scope');
      }
      return epoch;
    });
    if (new Set(normalizedEpochs).size !== normalizedEpochs.length) {
      throw new Error('Duplicate issuer key epoch scope');
    }

    return {
      tokenKeyId: tokenKeyIdText,
      publicKey: publicKeyBytes.toString('base64url'),
      epochs: normalizedEpochs.sort()
    };
  });

  keys.sort((left, right) => left.tokenKeyId.localeCompare(right.tokenKeyId));
  return {
    version: KEYSET_SCHEMA_VERSION,
    sequence: payload.sequence,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    keys
  };
};

const serializeIssuerKeySetPayload = (payload) => {
  const normalized = normalizePayload(payload);
  return Buffer.from(
    `${KEYSET_SIGNATURE_DOMAIN}\u0000${JSON.stringify(normalized)}`,
    'utf8'
  );
};

const assertTrustRoot = (trustRootPublicKey) => {
  let key;
  if (trustRootPublicKey instanceof crypto.KeyObject) {
    if (trustRootPublicKey.type !== 'public') {
      throw new Error('Research issuer key-set trust root must be public key material');
    }
    key = trustRootPublicKey;
  } else {
    key = crypto.createPublicKey(trustRootPublicKey);
  }
  if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') {
    throw new Error('Research issuer key-set trust root must be Ed25519 public key material');
  }
  return key;
};

const createResearchSignedIssuerKeySetStore = ({
  trustRootPublicKey,
  loadVerificationKey,
  now = () => Date.now()
}) => {
  const trustRoot = assertTrustRoot(trustRootPublicKey);
  if (typeof loadVerificationKey !== 'function') {
    throw new Error('Research issuer public-key loader is required');
  }
  if (typeof now !== 'function') {
    throw new Error('Research issuer key-set clock is required');
  }

  let current = null;

  const install = async (signedSnapshot) => {
    assertExactKeys(signedSnapshot, ['payload', 'signature'], 'signed issuer key-set snapshot');
    const normalized = normalizePayload(signedSnapshot.payload);
    const signature = decodeCanonicalBase64Url(signedSnapshot.signature, {
      minBytes: 64,
      maxBytes: 64,
      label: 'issuer key-set signature'
    });
    const message = serializeIssuerKeySetPayload(normalized);
    if (!crypto.verify(null, message, trustRoot, signature)) {
      throw new Error('Invalid issuer key-set signature');
    }

    const observedNow = now();
    if (!Number.isSafeInteger(observedNow)) {
      throw new Error('Invalid Research issuer key-set clock');
    }
    if (normalized.issuedAt > observedNow + MAX_CLOCK_SKEW_MS) {
      throw new Error('Issuer key-set snapshot is not active yet');
    }
    if (normalized.expiresAt <= observedNow) {
      throw new Error('Issuer key-set snapshot is expired');
    }
    if (current && normalized.sequence <= current.sequence) {
      throw new Error('Issuer key-set rollback or replay rejected');
    }

    const ringEntries = [];
    for (const entry of normalized.keys) {
      const publicKeyBytes = Buffer.from(entry.publicKey, 'base64url');
      const publicKey = assertVerificationOnlyPublicKey(
        await loadVerificationKey(Buffer.from(publicKeyBytes))
      );
      ringEntries.push({
        keyId: Buffer.from(entry.tokenKeyId, 'base64url'),
        publicKey,
        epochs: entry.epochs
      });
    }

    const ring = createResearchIssuerPublicKeyRing({ keys: ringEntries });
    const candidate = Object.freeze({
      sequence: normalized.sequence,
      issuedAt: normalized.issuedAt,
      expiresAt: normalized.expiresAt,
      ring
    });

    current = candidate;
    return Object.freeze({
      sequence: candidate.sequence,
      expiresAt: candidate.expiresAt
    });
  };

  const readiness = () => {
    if (!current) return Object.freeze({ ready: false, reason: 'missing' });
    if (current.expiresAt <= now()) {
      return Object.freeze({ ready: false, reason: 'expired' });
    }
    return Object.freeze({
      ready: true,
      sequence: current.sequence,
      expiresAt: current.expiresAt
    });
  };

  return Object.freeze({
    install,
    readiness,
    resolve({ tokenKeyId, epoch }) {
      if (!current || current.expiresAt <= now()) return null;
      return current.ring.resolve({ tokenKeyId, epoch });
    }
  });
};

module.exports = {
  KEYSET_SIGNATURE_DOMAIN,
  KEYSET_SCHEMA_VERSION,
  MAX_KEYS_PER_SNAPSHOT,
  MAX_SNAPSHOT_VALIDITY_MS,
  MAX_CLOCK_SKEW_MS,
  MIN_PUBLIC_KEY_BYTES,
  MAX_PUBLIC_KEY_BYTES,
  normalizePayload,
  serializeIssuerKeySetPayload,
  createResearchSignedIssuerKeySetStore
};
