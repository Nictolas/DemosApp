const PRODUCTION_CORS_ORIGINS = Object.freeze([
  'https://www.demos.community',
  'https://demos.community',
  'https://demos-c7k0.onrender.com'
]);

const DEVELOPMENT_CORS_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]);

const getAllowedCorsOrigins = (nodeEnv = process.env.NODE_ENV) => new Set(
  nodeEnv === 'production'
    ? PRODUCTION_CORS_ORIGINS
    : [...PRODUCTION_CORS_ORIGINS, ...DEVELOPMENT_CORS_ORIGINS]
);

const evaluateCorsOrigin = (origin, options = {}) => {
  const {
    nodeEnv = process.env.NODE_ENV,
    allowRequestsWithoutOrigin = true
  } = options;

  if (!origin) {
    return Object.freeze({
      allowed: allowRequestsWithoutOrigin,
      reason: allowRequestsWithoutOrigin ? 'non-browser-client' : 'origin-required'
    });
  }

  const allowed = getAllowedCorsOrigins(nodeEnv).has(origin);
  return Object.freeze({
    allowed,
    reason: allowed ? 'allowlisted-origin' : 'origin-not-allowlisted'
  });
};

module.exports = {
  PRODUCTION_CORS_ORIGINS,
  DEVELOPMENT_CORS_ORIGINS,
  getAllowedCorsOrigins,
  evaluateCorsOrigin
};
