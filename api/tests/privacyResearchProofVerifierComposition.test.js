const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  READ_OPINIONS_PURPOSE
} = require('../services/researchParticipantProofPolicy');
const {
  canonicalResearchProofMessage
} = require('../services/researchEd25519SignatureVerifier');
const {
  createResearchOpinionVectorProofVerifier
} = require('../services/researchOpinionVectorProofVerifierFactory');

const rawPublicKey = (publicKey) =>
  publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);

test('Research non-live composition verifies Ed25519 then consumes challenge exactly once', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const participantPublicKey = rawPublicKey(publicKey);
  const challenge = crypto.randomBytes(32).toString('base64url');
  const signature = crypto.sign(
    null,
    canonicalResearchProofMessage({
      purpose: READ_OPINIONS_PURPOSE,
      challenge
    }),
    privateKey
  );

  let deleteCalls = 0;
  const client = {
    async query(sql) {
      assert.match(sql, /^DELETE FROM research\.proof_challenges/im);
      deleteCalls += 1;
      return deleteCalls === 1
        ? { rows: [{ issued_at: '2026-10-02T00:00:00Z' }] }
        : { rows: [] };
    }
  };

  const verifier = createResearchOpinionVectorProofVerifier({ client });
  const input = {
    purpose: READ_OPINIONS_PURPOSE,
    participantPublicKey,
    challenge,
    signature
  };

  assert.deepEqual(await verifier.verify(input), {
    valid: true,
    challengeFresh: true,
    keyAlgorithm: 'ed25519'
  });
  assert.deepEqual(await verifier.verify(input), {
    valid: true,
    challengeFresh: false,
    keyAlgorithm: 'ed25519'
  });
  assert.equal(deleteCalls, 2);
});

test('Research non-live composition does not consume challenge when signature is invalid', async () => {
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  let queryCalls = 0;
  const client = {
    async query() {
      queryCalls += 1;
      return { rows: [] };
    }
  };

  const verifier = createResearchOpinionVectorProofVerifier({ client });
  const result = await verifier.verify({
    purpose: READ_OPINIONS_PURPOSE,
    participantPublicKey: rawPublicKey(publicKey),
    challenge: crypto.randomBytes(32).toString('base64url'),
    signature: Buffer.alloc(64)
  });

  assert.deepEqual(result, {
    valid: false,
    challengeFresh: false,
    keyAlgorithm: 'ed25519'
  });
  assert.equal(queryCalls, 0);
});
