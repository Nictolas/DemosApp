const crypto = require('crypto');

const DOMAIN = 'demos.research.participant-proof.v1';

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

const createEd25519ResearchSignatureVerifier = () => ({
  async verify({ purpose, participantPublicKey, challenge, signature }) {
    try {
      const message = canonicalResearchProofMessage({ purpose, challenge });
      const publicKey = crypto.createPublicKey(participantPublicKey);
      if (publicKey.asymmetricKeyType !== 'ed25519') return { valid: false };

      const signatureBytes = Buffer.isBuffer(signature)
        ? signature
        : Buffer.from(signature, 'base64url');

      return {
        valid: crypto.verify(null, message, publicKey, signatureBytes)
      };
    } catch {
      return { valid: false };
    }
  }
});

module.exports = {
  DOMAIN,
  canonicalResearchProofMessage,
  createEd25519ResearchSignatureVerifier
};
