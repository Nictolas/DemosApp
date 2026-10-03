const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  createResearchCredentialVerifierAdapter
} = require('../services/researchCredentialVerifierAdapter');
const {
  canonicalResearchProofMessage
} = require('../services/researchEd25519SignatureVerifier');
const {
  RENEW_PARTICIPATION_PURPOSE
} = require('../services/researchParticipantProofPolicy');
const {
  createResearchRenewalVerifierBundle
} = require('../services/researchRenewalVerifierBundle');
const {
  createResearchRenewalRedemptionShadowComposition
} = require('../services/researchRenewalShadowComposition');

const rawEd25519PublicKey = (publicKey) => {
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return spki.subarray(spki.length - 32);
};

test('credential adapter is verify-only, strips provider metadata and fails closed', async () => {
  assert.throws(
    () => createResearchCredentialVerifierAdapter({
      provider: {
        verify: async () => ({ valid: true }),
        sign: async () => Buffer.alloc(1)
      }
    }),
    /forbidden signing capability/
  );

  const adapter = createResearchCredentialVerifierAdapter({
    provider: {
      async verify() {
        return {
          valid: true,
          credentialVersion: 2,
          accountId: 'must-not-cross-boundary',
          providerTraceId: 'must-not-cross-boundary'
        };
      }
    }
  });

  assert.deepEqual(await adapter.verify({
    credentialBytes: Buffer.alloc(64),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), {
    valid: true,
    credentialVersion: 2
  });

  const failing = createResearchCredentialVerifierAdapter({
    provider: {
      async verify() {
        throw new Error('provider detail must stay private');
      }
    }
  });
  assert.deepEqual(await failing.verify({
    credentialBytes: Buffer.alloc(64),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), { valid: false });
});

test('renewal verifier bundle uses real Ed25519 verification and one-time Research challenge consumption', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const participantPublicKey = rawEd25519PublicKey(publicKey);
  const challenge = Buffer.alloc(32, 21).toString('base64url');
  const message = canonicalResearchProofMessage({
    purpose: RENEW_PARTICIPATION_PURPOSE,
    challenge
  });
  const signature = crypto.sign(null, message, privateKey);
  let challengeDeletes = 0;

  const client = {
    async query(sql) {
      assert.match(sql, /DELETE FROM research\.proof_challenges/);
      challengeDeletes += 1;
      return { rows: [{ issued_at: new Date() }] };
    }
  };

  const bundle = createResearchRenewalVerifierBundle({
    client,
    credentialProvider: {
      async verify() {
        return { valid: true, credentialVersion: 1 };
      }
    }
  });

  const proof = await bundle.participantProofVerifier.verify({
    purpose: RENEW_PARTICIPATION_PURPOSE,
    participantPublicKey,
    challenge,
    signature
  });

  assert.deepEqual(proof, {
    valid: true,
    challengeFresh: true,
    keyAlgorithm: 'ed25519'
  });
  assert.equal(challengeDeletes, 1);
  assert.deepEqual(await bundle.credentialVerifier.verify({
    credentialBytes: Buffer.alloc(64, 5),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), {
    valid: true,
    credentialVersion: 1
  });
});

test('shadow composition wires verifiers but remains absent from research-app', () => {
  const pool = { query: async () => ({ rows: [] }) };
  const router = createResearchRenewalRedemptionShadowComposition({
    getPool: () => pool,
    credentialProvider: {
      async verify() {
        return { valid: false };
      }
    },
    renewalLimiter: (req, res, next) => next()
  });

  assert.ok(router.stack.some((entry) => entry.route));

  const researchAppSource = fs.readFileSync(
    path.join(__dirname, '..', 'research-app.js'),
    'utf8'
  );
  const compositionSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchRenewalShadowComposition.js'),
    'utf8'
  );

  assert.doesNotMatch(
    researchAppSource,
    /researchRenewalShadowComposition|createResearchRenewalRedemptionShadowComposition/
  );
  assert.doesNotMatch(
    compositionSource,
    /middleware\/auth|jsonwebtoken|requireAuth|authenticate|authorization|Bearer|JWT|process\.env/
  );
});
