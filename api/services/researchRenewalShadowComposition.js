const { getResearchPool } = require('../config/researchDatabase');
const {
  researchRenewalLimiter
} = require('../middleware/researchRateLimiting');
const {
  createResearchRenewalRedemptionShadowRouter
} = require('../routes/researchRenewalRedemptionShadowRouter');
const {
  createResearchRenewalVerifierBundle
} = require('./researchRenewalVerifierBundle');

const createResearchRenewalRedemptionShadowComposition = ({
  getPool = getResearchPool,
  credentialProvider,
  signatureVerifier,
  renewalLimiter = researchRenewalLimiter
} = {}) => {
  const client = getPool();
  const verifierBundle = createResearchRenewalVerifierBundle({
    client,
    credentialProvider,
    ...(signatureVerifier === undefined ? {} : { signatureVerifier })
  });

  return createResearchRenewalRedemptionShadowRouter({
    getPool: () => client,
    renewalLimiter,
    ...verifierBundle
  });
};

module.exports = {
  createResearchRenewalRedemptionShadowComposition
};
