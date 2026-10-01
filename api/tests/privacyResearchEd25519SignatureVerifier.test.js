const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  DOMAIN,
  canonicalResearchProofMessage,
  createEd25519ResearchSignatureVerifier
} = require('../services/researchEd25519SignatureVerifier');

const sign = (privateKey, purpose, challenge) =>
  crypto.sign(null, canonicalResearchProofMessage({ purpose, challenge }), privateKey);

test('Research Ed25519 verifier accepts only the canonical purpose + challenge message', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const verifier = createEd25519ResearchSignatureVerifier();
  const purpose = 'read-opinions';
  const challenge = crypto.randomBytes(32).toString('base64url');
  const signature = sign(privateKey, purpose, challenge);

  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey: publicKey, challenge, signature }),
    { valid: true }
  );
  assert.deepEqual(
    await verifier.verify({ purpose: 'other-purpose', participantPublicKey: publicKey, challenge, signature }),
    { valid: false }
  );
  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey: publicKey, challenge: challenge + 'x', signature }),
    { valid: false }
  );
});

test('Research Ed25519 verifier rejects another key and malformed signatures fail closed', async () => {
  const signer = crypto.generateKeyPairSync('ed25519');
  const other = crypto.generateKeyPairSync('ed25519');
  const verifier = createEd25519ResearchSignatureVerifier();
  const purpose = 'read-opinions';
  const challenge = crypto.randomBytes(32).toString('base64url');
  const signature = sign(signer.privateKey, purpose, challenge);

  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey: other.publicKey, challenge, signature }),
    { valid: false }
  );
  assert.deepEqual(
    await verifier.verify({ purpose, participantPublicKey: signer.publicKey, challenge, signature: 'not-a-signature' }),
    { valid: false }
  );
});

test('canonical Research proof message is domain-separated and contains no Identity fields', () => {
  const message = canonicalResearchProofMessage({
    purpose: 'read-opinions',
    challenge: 'challenge-value'
  });

  assert.ok(message.includes(Buffer.from(DOMAIN, 'utf8')));
  const rendered = message.toString('utf8');
  for (const forbidden of ['account_id', 'user_id', 'email', 'identity']) {
    assert.equal(rendered.includes(forbidden), false);
  }
});
