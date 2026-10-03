const {
  PARTICIPANT_PROOF_PURPOSES
} = require('./researchParticipantProofPolicy');
const {
  consumeResearchProofChallenge
} = require('./researchProofChallengeStore');

const createResearchParticipantProofVerifier = ({
  client,
  signatureVerifier
}) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research participant verifier requires a PostgreSQL client');
  }
  if (!signatureVerifier || typeof signatureVerifier.verify !== 'function') {
    throw new Error('Research participant signature verifier is required');
  }

  return {
    async verify({
      purpose,
      participantPublicKey,
      challenge,
      signature
    }) {
      if (!PARTICIPANT_PROOF_PURPOSES.includes(purpose)) {
        return {
          valid: false,
          challengeFresh: false,
          keyAlgorithm: 'ed25519'
        };
      }

      const signatureResult = await signatureVerifier.verify({
        purpose,
        participantPublicKey,
        challenge,
        signature
      });

      const signatureValid =
        signatureResult === true ||
        (signatureResult && signatureResult.valid === true);

      if (!signatureValid) {
        return {
          valid: false,
          challengeFresh: false,
          keyAlgorithm: 'ed25519'
        };
      }

      const challengeFresh = await consumeResearchProofChallenge(client, {
        challenge,
        purpose
      });

      return {
        valid: true,
        challengeFresh,
        keyAlgorithm: 'ed25519'
      };
    }
  };
};

module.exports = {
  createResearchParticipantProofVerifier
};
