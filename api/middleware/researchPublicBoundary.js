const {
  researchPublicExposurePolicyFromEnv
} = require('../config/researchPublicExposurePolicy');

const createResearchPublicBoundaryMiddleware = ({
  policy = researchPublicExposurePolicyFromEnv()
} = {}) => (req, res, next) => {
  res.setHeader('Cache-Control', policy.cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  const origin = req.get('Origin');
  if (!origin) {
    return next();
  }

  if (!policy.allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Research origin not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
};

const researchPublicErrorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  return res.status(400).json({ error: 'Invalid Research request' });
};

module.exports = {
  createResearchPublicBoundaryMiddleware,
  researchPublicErrorHandler
};
