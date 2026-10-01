const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  DOMAIN,
  canonicalResearchProofMessage,
  createEd25519ResearchSignatureVerifier
} = require('../services/researchEd25519SignatureVerifier');

const rawPublicKey = (publicKey) =>
  publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);

const sign = (privateKey, purpose, challenge) =>
  crypto.sign(null, canonicalResearchProofMessage({ purpose, challenge }), privateKey);

test('Research Ed25519 verifier accepts the 32-byte raw public key required by the proof policy', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const verifier = createEd25519ResearchSignatureVerifier();
  const purpose = 'read-opinions-v1';
  const challenge = crypto.randomBytes(32).toString('base64url');
  const signature = sign(privateKey, purpose, challenge);
  const participantPublicKey = rawPublicKey(publicKey);

  assert.equal(participantPublicKey.length, 32);
  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey, challenge, signature }),
    { valid: true }
  );
  assert.deepEqual(
    await verifier.verify({ purpose: 'other-purpose', participantPublicKey, challenge, signature }),
    { valid: false }
  );
  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey, challenge: challenge + 'x', signature }),
    { valid: false }
  );
});

test('Research Ed25519 verifier rejects another raw key and malformed inputs fail closed', async () => {
  const signer = crypto.generateKeyPairSync('ed25519');
  const other = crypto.generateKeyPairSync('ed25519');
  const verifier = createEd25519ResearchSignatureVerifier();
  const purpose = 'read-opinions-v1';
  const challenge = crypto.randomBytes(32).toString('base64url');
  const signature = sign(signer.privateKey, purpose, challenge);

  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey: rawPublicKey(other.publicKey), challenge, signature }),
    { valid: false }
  );
  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey: rawPublicKey(signer.publicKey), challenge, signature: Buffer.alloc(63) }),
    { valid: false }
  );
  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey: Buffer.alloc(31), challenge, signature }),
    { valid: false }
  );
});

test('canonical Research proof message is domain-separated and contains no Identity fields', () => {
  const message = canonicalResearchProofMessage({
    purpose: 'read-opinions-v1',
    challenge: 'challenge-value'
  });

  assert.ok(message.includes(Buffer.from(DOMAIN, 'utf8')));
  const rendered = message.toString('utf8');
  for (const forbidden of ['account_id', 'user_id', 'email', 'identity']) {
    assert.equal(rendered.includes(forbidden), false);
  }
});
