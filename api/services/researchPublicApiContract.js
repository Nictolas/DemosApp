const {
  RESEARCH_PUBLIC_ROUTE_PREFIX
} = require('../config/researchPublicRequestPolicy');

const RESEARCH_PUBLIC_ENDPOINTS = Object.freeze({
  issueChallenge: Object.freeze({
    method: 'POST',
    path: RESEARCH_PUBLIC_ROUTE_PREFIX + '/proof-challenges',
    requestKeys: Object.freeze([]),
    responseKeys: Object.freeze(['challenge', 'purpose'])
  }),
  listPoliticalVectors: Object.freeze({
    method: 'POST',
    path: RESEARCH_PUBLIC_ROUTE_PREFIX + '/political-vectors',
    requestKeys: Object.freeze(['scope']),
    responseKeys: Object.freeze(['candidates'])
  }),
  readOpinionVector: Object.freeze({
    method: 'POST',
    path: RESEARCH_PUBLIC_ROUTE_PREFIX + '/opinion-vector/read',
    requestKeys: Object.freeze(['participantPublicKey', 'challenge', 'signature']),
    responseKeys: Object.freeze(['opinions'])
  }),
  readAnswerAggregates: Object.freeze({
    method: 'POST',
    path: RESEARCH_PUBLIC_ROUTE_PREFIX + '/answer-aggregates/read',
    requestKeys: Object.freeze(['questionId']),
    responseKeys: Object.freeze(['methodology', 'rows'])
  })
});

const FORBIDDEN_IDENTITY_KEYS = Object.freeze([
  'accountId', 'account_id', 'userId', 'user_id', 'email', 'subject',
  'sessionId', 'session_id', 'authorization', 'jwt', 'token', 'opinions', 'opinionVector', 'citizenOpinions'
]);

const assertResearchPublicPayload = (value, allowedKeys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Research public payload');
  }

  const keys = Object.keys(value);
  for (const forbidden of FORBIDDEN_IDENTITY_KEYS) {
    if (keys.includes(forbidden)) {
      throw new Error('Identity field forbidden at Research public boundary');
    }
  }
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      throw new Error('Unexpected Research public boundary field: ' + key);
    }
  }
  return true;
};

module.exports = {
  RESEARCH_PUBLIC_ROUTE_PREFIX,
  RESEARCH_PUBLIC_ENDPOINTS,
  FORBIDDEN_IDENTITY_KEYS,
  assertResearchPublicPayload
};
