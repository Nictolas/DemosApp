const rateLimit = require('express-rate-limit');

const RESEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RESEARCH_CHALLENGE_MAX = 30;
const RESEARCH_READ_MAX = 60;

const researchRateLimitOptions = ({ max }) => ({
  windowMs: RESEARCH_RATE_LIMIT_WINDOW_MS,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Research request rate limit exceeded' });
  }
});

const researchChallengeLimiter = rateLimit(
  researchRateLimitOptions({ max: RESEARCH_CHALLENGE_MAX })
);

const researchReadLimiter = rateLimit(
  researchRateLimitOptions({ max: RESEARCH_READ_MAX })
);

module.exports = {
  RESEARCH_RATE_LIMIT_WINDOW_MS,
  RESEARCH_CHALLENGE_MAX,
  RESEARCH_READ_MAX,
  researchRateLimitOptions,
  researchChallengeLimiter,
  researchReadLimiter
};
