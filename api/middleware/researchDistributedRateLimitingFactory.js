const rateLimit = require('express-rate-limit');
const {
  ResearchDistributedRateLimitStore
} = require('../services/researchDistributedRateLimitStore');

const RESEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RESEARCH_CHALLENGE_MAX = 30;
const RESEARCH_READ_MAX = 60;

const createLimiterOptions = ({ max, store, keyGenerator }) => ({
  windowMs: RESEARCH_RATE_LIMIT_WINDOW_MS,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  passOnStoreError: false,
  keyGenerator,
  store,
  handler: (req, res) => {
    res.status(429).json({ error: 'Research request rate limit exceeded' });
  }
});

const createResearchDistributedRateLimiters = ({
  backend,
  keySecret,
  keyGenerator,
  rateLimitFactory = rateLimit
}) => {
  if (!backend || typeof backend.increment !== 'function') {
    throw new Error('Research distributed rate-limit backend.increment is required');
  }
  if (!Buffer.isBuffer(keySecret) || keySecret.length < 32) {
    throw new Error('Research rate-limit key secret must be at least 32 bytes');
  }
  if (typeof keyGenerator !== 'function') {
    throw new Error('Research rate-limit key generator is required');
  }
  if (typeof rateLimitFactory !== 'function') {
    throw new Error('Research rate-limit factory is required');
  }

  const challengeStore = new ResearchDistributedRateLimitStore({
    backend,
    keySecret,
    namespace: 'challenge'
  });
  const readStore = new ResearchDistributedRateLimitStore({
    backend,
    keySecret,
    namespace: 'read'
  });

  return {
    researchChallengeLimiter: rateLimitFactory(
      createLimiterOptions({ max: RESEARCH_CHALLENGE_MAX, store: challengeStore, keyGenerator })
    ),
    researchReadLimiter: rateLimitFactory(
      createLimiterOptions({ max: RESEARCH_READ_MAX, store: readStore, keyGenerator })
    )
  };
};

module.exports = {
  RESEARCH_RATE_LIMIT_WINDOW_MS,
  RESEARCH_CHALLENGE_MAX,
  RESEARCH_READ_MAX,
  createLimiterOptions,
  createResearchDistributedRateLimiters
};
