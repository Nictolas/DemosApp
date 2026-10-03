const {
  createResearchSignedIssuerKeySetStore
} = require('./researchSignedIssuerKeySetStore');
const {
  createResearchPrivacyPassPublicKeyLoader
} = require('./researchPrivacyPassPublicKeyLoader');
const {
  createResearchPrivacyPassCredentialProvider
} = require('./researchPrivacyPassCredentialProvider');
const {
  createResearchIssuerKeySetFreshnessGate
} = require('./researchIssuerKeySetFreshnessGate');
const {
  toResearchIssuerKeySetHealth
} = require('./researchIssuerKeySetHealth');
const {
  canResearchUseIssuerKeySet
} = require('./researchIssuerKeySetHealthPolicy');

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
  minimumRemainingValidityMs,
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
  const freshnessGate = createResearchIssuerKeySetFreshnessGate({
    snapshotStore: keySetStore,
    minimumRemainingValidityMs,
    now
  });

  const installSignedSnapshotJson = async (snapshotJson) => {
    const parsedSnapshot = parseResearchSignedIssuerKeySetSnapshot(snapshotJson);
    const candidateStore = createResearchSignedIssuerKeySetStore({
      trustRootPublicKey,
      loadVerificationKey,
      now
    });
    const candidateGate = createResearchIssuerKeySetFreshnessGate({
      snapshotStore: candidateStore,
      minimumRemainingValidityMs,
      now
    });
    await candidateStore.install(parsedSnapshot);
    const candidateReadiness = candidateGate.readiness();
    if (candidateReadiness.ready !== true) {
      throw new Error('Research issuer key-set candidate is not fresh enough');
    }
    return keySetStore.install(parsedSnapshot);
  };

  await installSignedSnapshotJson(signedSnapshotJson);
  const initialReadiness = freshnessGate.readiness();
  if (initialReadiness.ready !== true) {
    throw new Error('Research issuer key-set bootstrap is not ready');
  }

  const credentialProvider = createResearchPrivacyPassCredentialProvider({
    privacyPass,
    issuerPublicKeyRing: freshnessGate,
    ...(issuerName === undefined ? {} : { issuerName }),
    ...(originInfo === undefined ? {} : { originInfo })
  });

  return Object.freeze({
    credentialProvider,
    readiness: () => freshnessGate.readiness(),
    health: () => toResearchIssuerKeySetHealth(freshnessGate.readiness()),
    usable: () => canResearchUseIssuerKeySet(
      toResearchIssuerKeySetHealth(freshnessGate.readiness())
    ),
    installSignedSnapshotJson
  });
};

const createResearchPrivacyPassKeySetBootstrapFromRecovery = async ({
  persistence,
  ...bootstrapOptions
} = {}) => {
  if (!persistence || typeof persistence.recoverAuthenticatedSnapshot !== 'function') {
    throw new Error('Research issuer key-set persistence recovery is required');
  }

  let recoveredBootstrap = null;
  let recovered;
  try {
    recovered = await persistence.recoverAuthenticatedSnapshot({
      revalidate: async (snapshotJson) => {
        const candidate = await createResearchPrivacyPassKeySetBootstrap({
          ...bootstrapOptions,
          signedSnapshotJson: snapshotJson
        });
        const readiness = candidate.readiness();
        if (readiness.ready !== true) {
          return readiness;
        }
        recoveredBootstrap = candidate;
        return readiness;
      }
    });
  } catch {
    const error = new Error('Research issuer key-set recovery failed');
    Object.defineProperty(error, 'health', {
      value: toResearchIssuerKeySetHealth(null, { recoveryFailed: true }),
      enumerable: true
    });
    throw error;
  }

  if (!recoveredBootstrap || recoveredBootstrap.readiness().ready !== true) {
    throw new Error('Recovered Research issuer key-set bootstrap is not ready');
  }
  const readiness = recoveredBootstrap.readiness();
  if (readiness.sequence !== recovered.sequence) {
    throw new Error('Recovered Research issuer key-set sequence mismatch');
  }
  return recoveredBootstrap;
};

module.exports = {
  MAX_SNAPSHOT_JSON_BYTES,
  parseResearchSignedIssuerKeySetSnapshot,
  createResearchPrivacyPassKeySetBootstrap,
  createResearchPrivacyPassKeySetBootstrapFromRecovery
};
