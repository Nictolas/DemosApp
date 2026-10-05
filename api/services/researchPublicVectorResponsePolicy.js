const VALID_ANSWERS = new Set(['f', 'c', 'i']);
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const MAX_RESEARCH_POLITICAL_VECTOR_ROWS = 500;
const MAX_RESEARCH_POLITICAL_OPINIONS_PER_ROW = 1024;
const MAX_RESEARCH_OPINION_VECTOR_ENTRIES = 2048;
const MAX_RESEARCH_QUESTION_ID_LENGTH = 128;
const MAX_RESEARCH_CANDIDATE_ID_LENGTH = 128;
const MAX_RESEARCH_DISPLAY_NAME_BYTES = 512;
const MAX_RESEARCH_AVATAR_CONFIG_BYTES = 8 * 1024;
const MAX_RESEARCH_POLITICAL_VECTOR_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_RESEARCH_OPINION_VECTOR_RESPONSE_BYTES = 256 * 1024;

const assertBoundedString = (value, { label, maxChars, maxBytes } = {}) => {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid ' + label);
  if (maxChars && value.length > maxChars) throw new Error('Invalid ' + label);
  if (maxBytes && Buffer.byteLength(value, 'utf8') > maxBytes) throw new Error('Invalid ' + label);
  if (/\p{Cc}/u.test(value)) throw new Error('Invalid ' + label);
  return value;
};

const normalizePublicOpinions = (opinions, { maxEntries } = {}) => {
  if (!opinions || typeof opinions !== 'object' || Array.isArray(opinions)) {
    throw new Error('Invalid Research public opinions');
  }
  const entries = Object.entries(opinions);
  if (!Number.isInteger(maxEntries) || maxEntries < 0 || entries.length > maxEntries) {
    throw new Error('Research public opinion vector exceeds entry limit');
  }

  const normalized = {};
  for (const [questionId, answer] of entries) {
    assertBoundedString(questionId, {
      label: 'Research question id',
      maxChars: MAX_RESEARCH_QUESTION_ID_LENGTH
    });
    if (FORBIDDEN_OBJECT_KEYS.has(questionId) || !VALID_ANSWERS.has(answer)) {
      throw new Error('Invalid Research public opinion entry');
    }
    normalized[questionId] = answer;
  }
  return Object.freeze(normalized);
};

const normalizeAvatarConfig = (value) => {
  if (value == null) return null;
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_RESEARCH_AVATAR_CONFIG_BYTES) {
    throw new Error('Invalid Research avatar config');
  }
  return Object.freeze(JSON.parse(serialized));
};

const assertResponseBytes = (response, maximumBytes, label) => {
  const serialized = JSON.stringify(response);
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > maximumBytes) {
    throw new Error(label + ' exceeds response size limit');
  }
  return response;
};

const buildResearchPoliticalVectorsPublicResponse = (candidates) => {
  if (!Array.isArray(candidates) || candidates.length > MAX_RESEARCH_POLITICAL_VECTOR_ROWS) {
    throw new Error('Invalid Research political vector rows');
  }
  const safeCandidates = candidates.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('Invalid Research political vector row');
    }
    return Object.freeze({
      candidateId: assertBoundedString(candidate.candidateId, {
        label: 'Research candidate id',
        maxChars: MAX_RESEARCH_CANDIDATE_ID_LENGTH
      }),
      displayName: assertBoundedString(candidate.displayName, {
        label: 'Research display name',
        maxBytes: MAX_RESEARCH_DISPLAY_NAME_BYTES
      }),
      avatarConfig: normalizeAvatarConfig(candidate.avatarConfig),
      opinions: normalizePublicOpinions(candidate.opinions, {
        maxEntries: MAX_RESEARCH_POLITICAL_OPINIONS_PER_ROW
      })
    });
  });
  const response = Object.freeze({ candidates: Object.freeze(safeCandidates) });
  return assertResponseBytes(response, MAX_RESEARCH_POLITICAL_VECTOR_RESPONSE_BYTES, 'Research political vector response');
};

const buildResearchOpinionVectorPublicResponse = (result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Invalid Research opinion vector result');
  }
  const response = Object.freeze({
    opinions: normalizePublicOpinions(result.opinions, {
      maxEntries: MAX_RESEARCH_OPINION_VECTOR_ENTRIES
    })
  });
  return assertResponseBytes(response, MAX_RESEARCH_OPINION_VECTOR_RESPONSE_BYTES, 'Research opinion vector response');
};

module.exports = {
  MAX_RESEARCH_POLITICAL_VECTOR_ROWS,
  MAX_RESEARCH_POLITICAL_OPINIONS_PER_ROW,
  MAX_RESEARCH_OPINION_VECTOR_ENTRIES,
  MAX_RESEARCH_POLITICAL_VECTOR_RESPONSE_BYTES,
  MAX_RESEARCH_OPINION_VECTOR_RESPONSE_BYTES,
  buildResearchPoliticalVectorsPublicResponse,
  buildResearchOpinionVectorPublicResponse
};
