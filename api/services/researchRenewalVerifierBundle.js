const {
  createResearchCredentialVerifierAdapter
} = require('./researchCredentialVerifierAdapter');
const {
  createEd25519ResearchSignatureVerifier
} = require('./researchEd25519SignatureVerifier');
const {
  createResearchParticipantProofVerifier
} = require('./researchParticipantProofVerifier');

const createResearchRenewalVerifierBundle = ({
  client,
  credentialProvider,
  signatureVerifier = createEd25519ResearchSignatureVerifier()
}) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research renewal verifier bundle requires a PostgreSQL client');
  }

  const credentialVerifier = createResearchCredentialVerifierAdapter({
    provider: credentialProvider
  });
  const participantProofVerifier = createResearchParticipantProofVerifier({
    client,
    signatureVerifier
  });

  return Object.freeze({
    credentialVerifier,
    participantProofVerifier
  });
};

module.exports = {
  createResearchRenewalVerifierBundle
};
