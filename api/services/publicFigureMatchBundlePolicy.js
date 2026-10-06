const crypto = require('crypto');

const ANSWERED_VALUES = new Set(['f', 'c', 'i']);
const QUESTION_ID_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
const CONTEXT_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MATCH_HANDLE_PATTERN = /^mh1_[A-Za-z0-9_-]{32,64}$/;
const MAX_REVEAL_HANDLES = 4;

const normalizeSecret = (secret) => {
  const value = Buffer.isBuffer(secret) ? secret : Buffer.from(String(secret || ''), 'utf8');
  if (value.length < 32) {
    throw new Error('Match handle secret must contain at least 32 bytes');
  }
  return value;
};

const validateContextId = (contextId) => {
  if (typeof contextId !== 'string' || !CONTEXT_ID_PATTERN.test(contextId)) {
    throw new Error('Invalid match context id');
  }
  return contextId;
};

const deriveMatchHandle = ({ figureId, contextId, secret }) => {
  if (figureId === undefined || figureId === null || String(figureId).length === 0) {
    throw new Error('Missing public figure id for handle derivation');
  }

  const normalizedContext = validateContextId(contextId);
  const digest = crypto
    .createHmac('sha256', normalizeSecret(secret))
    .update('demos-match-v1\0')
    .update(normalizedContext)
    .update('\0')
    .update(String(figureId))
    .digest('base64url');

  return `mh1_${digest}`;
};

const sanitizeOpinionVector = (opinions) => {
  if (!opinions || typeof opinions !== 'object' || Array.isArray(opinions)) {
    return {};
  }

  const sanitized = {};
  for (const [questionId, answer] of Object.entries(opinions)) {
    if (!QUESTION_ID_PATTERN.test(questionId)) continue;
    if (!ANSWERED_VALUES.has(answer)) continue;
    sanitized[questionId] = answer;
  }
  return sanitized;
};

const buildPublicFigureMatchBundle = ({ figures, contextId, secret }) => {
  validateContextId(contextId);
  normalizeSecret(secret);

  if (!Array.isArray(figures)) {
    throw new Error('Public figure match source must be an array');
  }

  const candidates = figures.flatMap((figure) => {
    if (!figure || figure.figureId === undefined || figure.figureId === null) return [];

    const opinions = sanitizeOpinionVector(figure.opinions);
    if (Object.keys(opinions).length === 0) return [];

    return [{
      matchHandle: deriveMatchHandle({
        figureId: figure.figureId,
        contextId,
        secret
      }),
      opinions
    }];
  });

  return {
    contextId,
    candidates
  };
};

const validateMatchRevealRequest = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid match reveal request');
  }

  const allowedKeys = new Set(['contextId', 'matchHandles']);
  const extraKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    throw new Error('Match reveal request contains forbidden fields');
  }

  const contextId = validateContextId(payload.contextId);
  if (!Array.isArray(payload.matchHandles)) {
    throw new Error('Match reveal handles must be an array');
  }
  if (payload.matchHandles.length < 1 || payload.matchHandles.length > MAX_REVEAL_HANDLES) {
    throw new Error('Match reveal handle count is outside the allowed range');
  }

  const uniqueHandles = [...new Set(payload.matchHandles)];
  if (uniqueHandles.length !== payload.matchHandles.length) {
    throw new Error('Match reveal handles must be unique');
  }
  if (!uniqueHandles.every((handle) => MATCH_HANDLE_PATTERN.test(handle))) {
    throw new Error('Invalid match reveal handle');
  }

  return {
    contextId,
    matchHandles: uniqueHandles
  };
};

module.exports = {
  MAX_REVEAL_HANDLES,
  deriveMatchHandle,
  buildPublicFigureMatchBundle,
  validateMatchRevealRequest
};
