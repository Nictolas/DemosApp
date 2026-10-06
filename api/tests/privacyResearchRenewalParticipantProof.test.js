const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  RENEW_PARTICIPATION_PURPOSE
} = require('../services/researchParticipantProofPolicy');
const {
  canonicalResearchProofMessage,
  createEd25519ResearchSignatureVerifier
} = require('../services/researchEd25519SignatureVerifier');
const {
  createResearchParticipantProofVerifier
} = require('../services/researchParticipantProofVerifier');
const {
  issueResearchRenewalProofChallenge,
  verifyAndRedeemRenewalWithParticipantProof
} = require('../services/researchVerifiedRenewalService');

const rawPublicKey = (publicKey) =>
  publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);

const makeClient = () => {
  const calls = [];
  let challengeConsumed = false;
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      const normalized = sql.trim().toLowerCase();
      if (normalized.includes('insert into research.proof_challenges')) return { rows: [] };
      if (normalized.startsWith('delete from research.proof_challenges')) {
        if (challengeConsumed) return { rows: [] };
        challengeConsumed = true;
        return { rows: [{ issued_at: '2026-10-03T12:00:00Z' }] };
      }
      if (['begin', 'commit', 'rollback'].includes(normalized)) return { rows: [] };
      if (normalized.includes('insert into research.spent_credentials')) {
        return { rows: [{ redeemed_at: '2026-10-03T12:00:01Z' }] };
      }
      if (normalized.includes('update research.participants')) {
        return {
          rows: [{
            participant_id: 'shadow-participant',
            key_algorithm: 'ed25519',
            credential_version: 2,
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            last_confirmed_at: '2026-10-03T12:00:01Z',
            expires_at: '2027-10-03T12:00:01Z'
          }]
        };
      }
      throw new Error('unexpected query: ' + sql);
    }
  };
};

const validCredentialVerifier = {
  async verify({ purpose }) {
    return { valid: purpose === 'renew', credentialVersion: 2 };
  }
};

test('renewal requires fresh Ed25519 proof of possession before credential redemption', async () => {
  const client = makeClient();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const participantPublicKey = rawPublicKey(publicKey);
  const issued = await issueResearchRenewalProofChallenge(client, {
    randomBytes: () => Buffer.alloc(32, 7)
  });
  assert.equal(issued.purpose, RENEW_PARTICIPATION_PURPOSE);

  const signature = crypto.sign(
    null,
    canonicalResearchProofMessage({
      purpose: RENEW_PARTICIPATION_PURPOSE,
      challenge: issued.challenge
    }),
    privateKey
  );
  const participantProofVerifier = createResearchParticipantProofVerifier({
    client,
    signatureVerifier: createEd25519ResearchSignatureVerifier()
  });

  const result = await verifyAndRedeemRenewalWithParticipantProof(
    client,
    {
      credentialBytes: Buffer.alloc(64, 3),
      epoch: '2026-Q4',
      participantPublicKey,
      challenge: issued.challenge,
      signature
    },
    validCredentialVerifier,
    participantProofVerifier
  );

  assert.equal(result.redeemed, true);
  const challengeDelete = client.calls.find(({ sql }) => sql.trim().toLowerCase().startsWith('delete from research.proof_challenges'));
  assert.equal(challengeDelete.params[1], RENEW_PARTICIPATION_PURPOSE);
  assert.equal(client.calls.filter(({ sql }) => sql.includes('spent_credentials')).length, 1);
});

test('stolen renewal credential cannot renew another participant without its private key', async () => {
  const client = makeClient();
  const owner = crypto.generateKeyPairSync('ed25519');
  const attacker = crypto.generateKeyPairSync('ed25519');
  const participantPublicKey = rawPublicKey(owner.publicKey);
  const challenge = Buffer.alloc(32, 8).toString('base64url');
  const attackerSignature = crypto.sign(
    null,
    canonicalResearchProofMessage({
      purpose: RENEW_PARTICIPATION_PURPOSE,
      challenge
    }),
    attacker.privateKey
  );
  const participantProofVerifier = createResearchParticipantProofVerifier({
    client,
    signatureVerifier: createEd25519ResearchSignatureVerifier()
  });

  await assert.rejects(() => verifyAndRedeemRenewalWithParticipantProof(
    client,
    {
      credentialBytes: Buffer.alloc(64, 4),
      epoch: '2026-Q4',
      participantPublicKey,
      challenge,
      signature: attackerSignature
    },
    validCredentialVerifier,
    participantProofVerifier
  ));

  assert.equal(client.calls.length, 0);
});

test('renewal participant proof challenge is one-shot', async () => {
  const client = makeClient();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const participantPublicKey = rawPublicKey(publicKey);
  const issued = await issueResearchRenewalProofChallenge(client, {
    randomBytes: () => Buffer.alloc(32, 9)
  });
  const signature = crypto.sign(
    null,
    canonicalResearchProofMessage({ purpose: RENEW_PARTICIPATION_PURPOSE, challenge: issued.challenge }),
    privateKey
  );
  const participantProofVerifier = createResearchParticipantProofVerifier({
    client,
    signatureVerifier: createEd25519ResearchSignatureVerifier()
  });
  const input = {
    credentialBytes: Buffer.alloc(64, 5),
    epoch: '2026-Q4',
    participantPublicKey,
    challenge: issued.challenge,
    signature
  };

  assert.equal((await verifyAndRedeemRenewalWithParticipantProof(client, input, validCredentialVerifier, participantProofVerifier)).redeemed, true);
  await assert.rejects(() => verifyAndRedeemRenewalWithParticipantProof(client, input, validCredentialVerifier, participantProofVerifier));
  assert.equal(client.calls.filter(({ sql }) => sql.includes('spent_credentials')).length, 1);
});
