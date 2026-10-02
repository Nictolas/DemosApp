const {
  createResearchAtomicRateLimitBackend
} = require('./services/researchAtomicRateLimitBackend');
const {
  createResearchDistributedRateLimiters
} = require('./middleware/researchDistributedRateLimitingFactory');

const createResearchDistributedRateLimitPoc = ({
  evalScript,
  keySecret,
  rateLimitFactory,
  now
}) => {
  const backend = createResearchAtomicRateLimitBackend({
    evalScript,
    now
  });

  const limiters = createResearchDistributedRateLimiters({
    backend,
    keySecret,
    rateLimitFactory
  });

  return {
    backend,
    ...limiters
  };
};

module.exports = {
  createResearchDistributedRateLimitPoc
};
