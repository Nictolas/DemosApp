const { verifyUnlinkableCredential } = require('./unlinkableCredentialVerifier');
const { redeemEnrollmentCredential } = require('./researchEnrollmentRedemptionService');
const { redeemRenewalCredential } = require('./researchRenewalRedemptionService');

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

  const redemption = purpose === 'renew' ? redeemRenewalCredential : redeemEnrollmentCredential;
  return redemption(client, {
    credentialDigest: verified.credentialDigest,
    purpose,
    epoch,
    participantPublicKey,
    keyAlgorithm,
    credentialVersion: verified.credentialVersion
  });
};

module.exports = { verifyAndRedeemEnrollmentCredential };
