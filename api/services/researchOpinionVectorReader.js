const {
  readCurrentResearchOpinionVector
} = require('./researchOpinionVectorService');
const {
  createResearchOpinionVectorProofVerifier
} = require('./researchOpinionVectorProofVerifierFactory');

const createResearchOpinionVectorReader = ({ client }) => {
  const verifier = createResearchOpinionVectorProofVerifier({ client });

  return {
    async read(proof) {
      return readCurrentResearchOpinionVector(client, proof, verifier);
    }
  };
};

module.exports = {
  createResearchOpinionVectorReader
};
