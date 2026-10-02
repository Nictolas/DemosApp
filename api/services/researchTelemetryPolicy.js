const FORBIDDEN_RESEARCH_LOG_KEYS = Object.freeze([
  'userId',
  'accountId',
  'email',
  'authorization',
  'token',
  'jwt',
  'participantPublicKey',
  'challenge',
  'signature',
  'opinions',
  'opinionVector',
  'answers'
]);

const ALLOWED_RESEARCH_EVENT_FIELDS = Object.freeze([
  'event',
  'status',
  'durationBucket',
  'route',
  'method'
]);

const sanitizeResearchTelemetry = (event = {}) => {
  const sanitized = {};
  for (const key of ALLOWED_RESEARCH_EVENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(event, key)) {
      const value = event[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
};

module.exports = {
  FORBIDDEN_RESEARCH_LOG_KEYS,
  ALLOWED_RESEARCH_EVENT_FIELDS,
  sanitizeResearchTelemetry
};
