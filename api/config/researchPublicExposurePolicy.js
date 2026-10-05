const {
  RESEARCH_PUBLIC_MAX_BODY_BYTES
} = require('./researchPublicRequestPolicy');

const DEFAULT_ALLOWED_ORIGINS = Object.freeze([]);

const parseAllowedOrigins = (value = '') => Object.freeze(
  String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const createResearchPublicExposurePolicy = ({
  shadowEnabled,
  publicApiEnabled,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS
}) => Object.freeze({
  mountAllowed: shadowEnabled === true && publicApiEnabled === true,
  allowedOrigins: Object.freeze([...allowedOrigins]),
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
  parseAllowedOrigins,
  createResearchPublicExposurePolicy,
  researchPublicExposurePolicyFromEnv
};
