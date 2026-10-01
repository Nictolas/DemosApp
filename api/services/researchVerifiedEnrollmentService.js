const { verifyUnlinkableCredential } = require('./unlinkableCredentialVerifier');
const { redeemEnrollmentCredential } = require('./researchEnrollmentRedemptionService');

const verifyAndRedeemEnrollmentCredential = async (
  client,
  {
    credentialBytes,
    purpose,
    epoch,
    participantPublicKey,
    keyAlgorithm = 'ed25519'
  },
  verifier
) => {
  const verified = await verifyUnlinkableCredential({
    credentialBytes,
    purpose,
    epoch,
    verifier
  });

  return redeemEnrollmentCredential(client, {
    credentialDigest: verified.credentialDigest,
    purpose,
    epoch,
    participantPublicKey,
    keyAlgorithm,
    credentialVersion: verified.credentialVersion
  });
};

module.exports = { verifyAndRedeemEnrollmentCredential };
