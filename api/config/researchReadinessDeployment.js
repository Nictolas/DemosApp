const crypto = require('node:crypto');

const MAX_MANIFEST_BYTES = 16 * 1024;
const MAX_SIGNATURE_CHARS = 256;
const MAX_PUBLIC_KEY_CHARS = 1024;

const readBounded = (value, max) =>
  typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= max
    ? value
    : null;

const loadResearchReadinessDeployment = (env = {}) => {
  try {
    const manifestRaw = readBounded(env.RESEARCH_READINESS_MANIFEST, MAX_MANIFEST_BYTES);
    const signature = readBounded(env.RESEARCH_READINESS_SIGNATURE, MAX_SIGNATURE_CHARS);
    const publicKeyPem = readBounded(env.RESEARCH_READINESS_PUBLIC_KEY, MAX_PUBLIC_KEY_CHARS);
    if (!manifestRaw || !signature || !publicKeyPem) return Object.freeze({ configured: false });

    const manifest = JSON.parse(manifestRaw);
    if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') {
      return Object.freeze({ configured: false });
    }
    const publicKey = crypto.createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') {
      return Object.freeze({ configured: false });
    }
    return Object.freeze({ configured: true, manifest, signature, publicKey });
  } catch {
    return Object.freeze({ configured: false });
  }
};

module.exports = {
  MAX_MANIFEST_BYTES,
  loadResearchReadinessDeployment
};
