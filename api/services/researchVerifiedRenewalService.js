const {
  RENEW_PARTICIPATION_PURPOSE,
  verifyResearchParticipantProof
} = require('./researchParticipantProofPolicy');
const {
  issueResearchProofChallenge
} = require('./researchProofChallengeStore');
const {
  verifyAndRedeemEnrollmentCredential
} = require('./researchVerifiedEnrollmentService');

const issueResearchRenewalProofChallenge = async (
  client,
  { ttlSeconds, randomBytes } = {}
) => issueResearchProofChallenge(client, {
  purpose: RENEW_PARTICIPATION_PURPOSE,
  ...(ttlSeconds === undefined ? {} : { ttlSeconds }),
  ...(randomBytes === undefined ? {} : { randomBytes })
});

const verifyAndRedeemRenewalWithParticipantProof = async (
  client,
  {
    credentialBytes,
    epoch,
    participantPublicKey,
    challenge,
    signature
  },
  credentialVerifier,
  participantProofVerifier
) => {
  await verifyResearchParticipantProof({
    participantPublicKey,
    challenge,
    signature,
    purpose: RENEW_PARTICIPATION_PURPOSE,
    verifier: participantProofVerifier
  });

  return verifyAndRedeemEnrollmentCredential(
    client,
    {
      credentialBytes,
      purpose: 'renew',
      epoch,
      participantPublicKey
    },
    credentialVerifier
  );
};

module.exports = {
  issueResearchRenewalProofChallenge,
  verifyAndRedeemRenewalWithParticipantProof
};
