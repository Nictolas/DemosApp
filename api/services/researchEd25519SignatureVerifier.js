const crypto = require('crypto');

const DOMAIN = 'demos.research.participant-proof.v1';
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

const encodeField = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid Research proof ${label}`);
  }
  const bytes = Buffer.from(value, 'utf8');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
};

const canonicalResearchProofMessage = ({ purpose, challenge }) => Buffer.concat([
  Buffer.from(DOMAIN, 'utf8'),
  Buffer.from([0]),
  encodeField(purpose, 'purpose'),
  encodeField(challenge, 'challenge')
]);

const importRawEd25519PublicKey = (participantPublicKey) => {
  if (!Buffer.isBuffer(participantPublicKey) || participantPublicKey.length !== 32) {
    throw new Error('Invalid Research Ed25519 public key');
  }

  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, participantPublicKey]),
    format: 'der',
    type: 'spki'
  });
};

const createEd25519ResearchSignatureVerifier = () => ({
  async verify({ purpose, participantPublicKey, challenge, signature }) {
    try {
      const message = canonicalResearchProofMessage({ purpose, challenge });
      const publicKey = importRawEd25519PublicKey(participantPublicKey);
      if (!Buffer.isBuffer(signature) || signature.length !== 64) {
        return { valid: false };
      }

      return {
        valid: crypto.verify(null, message, publicKey, signature)
      };
    } catch {
      return { valid: false };
    }
  }
});

module.exports = {
  DOMAIN,
  canonicalResearchProofMessage,
  importRawEd25519PublicKey,
  createEd25519ResearchSignatureVerifier
};
