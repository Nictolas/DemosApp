const {
  evaluateResearchClientAddressTrust
} = require('../config/researchClientAddressTrustPolicy');
const {
  createResearchClientAddressKeyGenerator
} = require('./researchClientAddressKeyPolicy');

const createResearchEvidenceGatedClientKeyGenerator = ({
  trustDecisions,
  trustedProxyHops,
  isTrustedProxyAddress
} = {}) => {
  const evaluation = evaluateResearchClientAddressTrust(trustDecisions);
  if (!evaluation.approved) {
    throw new Error(
      'Research client-address trust evidence is incomplete: ' + evaluation.blockers.join(',')
    );
  }

  return createResearchClientAddressKeyGenerator({
    trustedProxyHops,
    isTrustedProxyAddress
  });
};

module.exports = {
  createResearchEvidenceGatedClientKeyGenerator
};
