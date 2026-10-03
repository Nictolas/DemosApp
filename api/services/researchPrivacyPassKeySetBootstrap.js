const {
  createResearchSignedIssuerKeySetStore
} = require('./researchSignedIssuerKeySetStore');
const {
  createResearchPrivacyPassPublicKeyLoader
} = require('./researchPrivacyPassPublicKeyLoader');
const {
  createResearchPrivacyPassCredentialProvider
} = require('./researchPrivacyPassCredentialProvider');

const MAX_SNAPSHOT_JSON_BYTES = 64 * 1024;

const parseResearchSignedIssuerKeySetSnapshot = (snapshotJson) => {
  if (!Buffer.isBuffer(snapshotJson) && typeof snapshotJson !== 'string') {
    throw new Error('Research issuer key-set snapshot JSON is required');
  }
  const bytes = Buffer.isBuffer(snapshotJson)
    ? Buffer.from(snapshotJson)
    : Buffer.from(snapshotJson, 'utf8');
  if (bytes.length === 0 || bytes.length > MAX_SNAPSHOT_JSON_BYTES) {
    throw new Error('Invalid Research issuer key-set snapshot size');
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Invalid Research issuer key-set snapshot JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid Research issuer key-set snapshot JSON');
  }
  return parsed;
};

const createResearchPrivacyPassKeySetBootstrap = async ({
  privacyPass,
  trustRootPublicKey,
  signedSnapshotJson,
  subtle,
  now = () => Date.now(),
  issuerName,
  originInfo
} = {}) => {
  const loadVerificationKey = createResearchPrivacyPassPublicKeyLoader({
    privacyPass,
    ...(subtle === undefined ? {} : { subtle })
  });
  const keySetStore = createResearchSignedIssuerKeySetStore({
    trustRootPublicKey,
    loadVerificationKey,
    now
  });

  const installSignedSnapshotJson = async (snapshotJson) =>
    keySetStore.install(parseResearchSignedIssuerKeySetSnapshot(snapshotJson));

  await installSignedSnapshotJson(signedSnapshotJson);
  const initialReadiness = keySetStore.readiness();
  if (initialReadiness.ready !== true) {
    throw new Error('Research issuer key-set bootstrap is not ready');
  }

  const credentialProvider = createResearchPrivacyPassCredentialProvider({
    privacyPass,
    issuerPublicKeyRing: keySetStore,
    ...(issuerName === undefined ? {} : { issuerName }),
    ...(originInfo === undefined ? {} : { originInfo })
  });

  return Object.freeze({
    credentialProvider,
    readiness: () => keySetStore.readiness(),
    installSignedSnapshotJson
  });
};

module.exports = {
  MAX_SNAPSHOT_JSON_BYTES,
  parseResearchSignedIssuerKeySetSnapshot,
  createResearchPrivacyPassKeySetBootstrap
};
