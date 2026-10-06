const {
  researchPublicExposurePolicyFromEnv
} = require('../config/researchPublicExposurePolicy');
const {
  RESEARCH_PUBLIC_ROUTE_PREFIX,
  RESEARCH_PUBLIC_JSON_MEDIA_TYPE,
  FORBIDDEN_RESEARCH_PUBLIC_HEADERS
} = require('../config/researchPublicRequestPolicy');
const {
  sendResearchPublicError
} = require('../services/researchPublicErrorPolicy');

const requestHeader = (req, name) => {
  if (req && typeof req.get === 'function') return req.get(name);
  return req?.headers?.[String(name).toLowerCase()];
};

const requestPath = (req) => {
  if (typeof req?.path === 'string') return req.path;
  if (typeof req?.originalUrl === 'string') return req.originalUrl.split('?')[0];
  if (typeof req?.url === 'string') return req.url.split('?')[0];
  return '';
};

const isResearchPublicApiRequest = (req) => {
  const path = requestPath(req);
  return path === RESEARCH_PUBLIC_ROUTE_PREFIX || path.startsWith(RESEARCH_PUBLIC_ROUTE_PREFIX + '/');
};

const hasQueryString = (req) => (
  (typeof req?.originalUrl === 'string' && req.originalUrl.includes('?')) ||
  (req?.query && typeof req.query === 'object' && Object.keys(req.query).length > 0)
);

const mediaType = (value) => String(value || '').split(';', 1)[0].trim().toLowerCase();

const createResearchPublicBoundaryMiddleware = ({
  policy = researchPublicExposurePolicyFromEnv()
} = {}) => (req, res, next) => {
  res.setHeader('Cache-Control', policy.cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  const origin = requestHeader(req, 'Origin');
  if (origin) {
    if (!policy.allowedOrigins.includes(origin)) {
      return sendResearchPublicError(res, 403);
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS' && origin) {
    return res.status(204).end();
  }

  if (!isResearchPublicApiRequest(req)) {
    return next();
  }

  for (const header of FORBIDDEN_RESEARCH_PUBLIC_HEADERS) {
    if (requestHeader(req, header) !== undefined) {
      return sendResearchPublicError(res, 400);
    }
  }

  if (hasQueryString(req)) {
    return sendResearchPublicError(res, 400);
  }

  if (
    req.method === 'POST' &&
    mediaType(requestHeader(req, 'Content-Type')) !== RESEARCH_PUBLIC_JSON_MEDIA_TYPE
  ) {
    return sendResearchPublicError(res, 415);
  }

  return next();
};

const researchPublicErrorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  return sendResearchPublicError(res, 400);
};

module.exports = {
  requestHeader,
  requestPath,
  isResearchPublicApiRequest,
  hasQueryString,
  mediaType,
  createResearchPublicBoundaryMiddleware,
  researchPublicErrorHandler
};
