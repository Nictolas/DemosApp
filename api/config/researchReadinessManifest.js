const crypto = require('node:crypto');

const READINESS_MANIFEST_VERSION = 1;
const REQUIRED_EVIDENCE_KEYS = Object.freeze([
  'researchDatabaseConfiguration',
  'researchSchemaValidation',
  'researchSastEvidence',
  'researchServiceBlueprint',
  'rateLimitSecretLifecycle',
  'distributedRateLimitProvider',
  'telemetryRetention',
  'telemetrySink',
  'publicOrigins'
]);

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

const assertExactEvidenceShape = (evidence) => {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('Invalid Research readiness evidence');
  const keys = Object.keys(evidence).sort();
  const required = [...REQUIRED_EVIDENCE_KEYS].sort();
  if (keys.length !== required.length || keys.some((key, index) => key !== required[index])) throw new Error('Invalid Research readiness evidence keys');
  for (const key of REQUIRED_EVIDENCE_KEYS) {
    if (typeof evidence[key] !== 'boolean') throw new Error('Invalid Research readiness evidence value');
  }
};

const canonicalizeReadinessManifest = (manifest) => {
  if (!manifest || manifest.version !== READINESS_MANIFEST_VERSION) {
    throw new Error('Unsupported Research readiness manifest');
  }
  if (!COMMIT_SHA_PATTERN.test(manifest.commitSha || '')) throw new Error('Invalid Research readiness commit SHA');
  const evidence = manifest.evidence;
  assertExactEvidenceShape(evidence);
  const normalizedEvidence = Object.fromEntries(REQUIRED_EVIDENCE_KEYS.map((key) => [key, evidence[key]]));
  return JSON.stringify({
    version: READINESS_MANIFEST_VERSION,
    issuedAt: String(manifest.issuedAt || ''),
    expiresAt: String(manifest.expiresAt || ''),
    commitSha: manifest.commitSha,
    evidence: normalizedEvidence
  });
};

const verifyResearchReadinessManifest = ({
  manifest,
  signature,
  publicKey,
  now = new Date(),
  expectedCommitSha
} = {}) => {
  try {
    if (!COMMIT_SHA_PATTERN.test(expectedCommitSha || '') || manifest?.commitSha !== expectedCommitSha) {
      return { valid: false, evidence: {} };
    }
    const keyObject = crypto.createPublicKey(publicKey);
    if (keyObject.asymmetricKeyType !== 'ed25519') return { valid: false, evidence: {} };
    if (!publicKey || typeof signature !== 'string' || !/^[A-Za-z0-9_-]+$/.test(signature)) {
      return { valid: false, evidence: {} };
    }
    const issuedAt = new Date(manifest?.issuedAt);
    const expiresAt = new Date(manifest?.expiresAt);
    const current = now instanceof Date ? now : new Date(now);
    if (![issuedAt, expiresAt, current].every((value) => Number.isFinite(value.getTime()))) {
      return { valid: false, evidence: {} };
    }
    if (issuedAt > current || expiresAt <= current || expiresAt <= issuedAt) {
      return { valid: false, evidence: {} };
    }
    const payload = Buffer.from(canonicalizeReadinessManifest(manifest), 'utf8');
    const signatureBytes = Buffer.from(signature, 'base64url');
    if (!crypto.verify(null, payload, keyObject, signatureBytes)) {
      return { valid: false, evidence: {} };
    }
    const evidence = Object.fromEntries(
      REQUIRED_EVIDENCE_KEYS.map((key) => [key, Object.freeze({ approved: manifest.evidence?.[key] === true })])
    );
    if (Object.values(evidence).some((item) => item.approved !== true)) {
      return { valid: false, evidence: {} };
    }
    return { valid: true, evidence: Object.freeze(evidence) };
  } catch {
    return { valid: false, evidence: {} };
  }
};

module.exports = {
  READINESS_MANIFEST_VERSION,
  REQUIRED_EVIDENCE_KEYS,
  COMMIT_SHA_PATTERN,
  assertExactEvidenceShape,
  canonicalizeReadinessManifest,
  verifyResearchReadinessManifest
};
