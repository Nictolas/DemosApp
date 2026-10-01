const {
  createEd25519ResearchSignatureVerifier
} = require('./researchEd25519SignatureVerifier');
const {
  createResearchParticipantProofVerifier
} = require('./researchParticipantProofVerifier');

const createResearchOpinionVectorProofVerifier = ({ client }) =>
  createResearchParticipantProofVerifier({
    client,
    signatureVerifier: createEd25519ResearchSignatureVerifier()
  });

module.exports = {
  createResearchOpinionVectorProofVerifier
};
