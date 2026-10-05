const RESEARCH_PUBLIC_ERROR_BODIES = Object.freeze({
  invalid: Object.freeze({ error: 'Invalid Research request' }),
  rateLimited: Object.freeze({ error: 'Research request rate limit exceeded' })
});

const RESEARCH_PUBLIC_ERROR_MAX_BYTES = 64;
const ALLOWED_PUBLIC_ERROR_STATUS = new Set([400, 403, 404, 413, 415, 429]);

const applyResearchPublicSafetyHeaders = (res) => {
  if (typeof res?.setHeader === 'function') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return res;
};

const buildResearchPublicError = (statusCode) => {
  if (!ALLOWED_PUBLIC_ERROR_STATUS.has(statusCode)) {
    throw new Error('Unsupported Research public error status');
  }
  const body = statusCode === 429
    ? RESEARCH_PUBLIC_ERROR_BODIES.rateLimited
    : RESEARCH_PUBLIC_ERROR_BODIES.invalid;
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > RESEARCH_PUBLIC_ERROR_MAX_BYTES) {
    throw new Error('Research public error response exceeds size bound');
  }
  return body;
};

const sendResearchPublicError = (res, statusCode) => {
  const body = buildResearchPublicError(statusCode);
  applyResearchPublicSafetyHeaders(res);
  return res.status(statusCode).json(body);
};

module.exports = {
  RESEARCH_PUBLIC_ERROR_BODIES,
  RESEARCH_PUBLIC_ERROR_MAX_BYTES,
  applyResearchPublicSafetyHeaders,
  buildResearchPublicError,
  sendResearchPublicError
};
