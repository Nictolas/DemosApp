const {
  RESEARCH_PUBLIC_MAX_BODY_BYTES
} = require('./researchPublicRequestPolicy');

const DEFAULT_ALLOWED_ORIGINS = Object.freeze([]);
const MAX_RESEARCH_PUBLIC_ORIGINS = 8;
const MAX_RESEARCH_PUBLIC_ORIGIN_LENGTH = 256;

const normalizeAllowedOrigin = (value) => {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.length > MAX_RESEARCH_PUBLIC_ORIGIN_LENGTH) {
    throw new Error('Invalid Research allowed origin');
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Invalid Research allowed origin');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.origin === 'null'
  ) {
    throw new Error('Invalid Research allowed origin');
  }

  return url.origin;
};

const normalizeAllowedOrigins = (values = DEFAULT_ALLOWED_ORIGINS) => {
  if (!Array.isArray(values) || values.length > MAX_RESEARCH_PUBLIC_ORIGINS) {
    throw new Error('Invalid Research allowed origins');
  }
  return Object.freeze([...new Set(values.map(normalizeAllowedOrigin))]);
};

const parseAllowedOrigins = (value = '') => {
  const values = String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return normalizeAllowedOrigins(values);
};

const createResearchPublicExposurePolicy = ({
  shadowEnabled,
  publicApiEnabled,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS
}) => Object.freeze({
  mountAllowed: shadowEnabled === true && publicApiEnabled === true,
  allowedOrigins: normalizeAllowedOrigins(allowedOrigins),
  allowCredentials: false,
  maxBodyBytes: RESEARCH_PUBLIC_MAX_BODY_BYTES,
  cacheControl: 'no-store',
  errorBodyKeys: Object.freeze(['error'])
});

const researchPublicExposurePolicyFromEnv = () => createResearchPublicExposurePolicy({
  shadowEnabled: String(process.env.PRIVACY_RESEARCH_SHADOW_ENABLED || '').toLowerCase() === 'true',
  publicApiEnabled: String(process.env.PRIVACY_RESEARCH_PUBLIC_API_ENABLED || '').toLowerCase() === 'true',
  allowedOrigins: parseAllowedOrigins(process.env.PRIVACY_RESEARCH_ALLOWED_ORIGINS)
});

module.exports = {
  MAX_RESEARCH_PUBLIC_ORIGINS,
  MAX_RESEARCH_PUBLIC_ORIGIN_LENGTH,
  normalizeAllowedOrigin,
  normalizeAllowedOrigins,
  parseAllowedOrigins,
  createResearchPublicExposurePolicy,
  researchPublicExposurePolicyFromEnv
};
