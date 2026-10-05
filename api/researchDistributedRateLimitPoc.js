const {
  createResearchAtomicRateLimitBackend
} = require('./services/researchAtomicRateLimitBackend');
const {
  createResearchDistributedRateLimiters
} = require('./middleware/researchDistributedRateLimitingFactory');

const createResearchDistributedRateLimitPoc = ({
  evalScript,
  keySecret,
  keyGenerator,
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
    keyGenerator,
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
