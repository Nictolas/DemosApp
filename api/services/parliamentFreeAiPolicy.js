'use strict';

/**
 * DEMOS parliamentary AI runs on explicitly allowlisted Groq Free Plan models only.
 * This module never selects a paid inference provider. Keep model availability and
 * free-tier limits under review before expanding the allowlist.
 */
const DEFAULT_FREE_GROQ_MODEL = 'openai/gpt-oss-120b';

const FREE_GROQ_MODELS = Object.freeze([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
]);

const RETIRED_GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen/qwen3.6-27b',
]);

function resolveFreeGroqModel(configuredModel) {
  const model = typeof configuredModel === 'string' && configuredModel.trim()
    ? configuredModel.trim()
    : DEFAULT_FREE_GROQ_MODEL;

  if (RETIRED_GROQ_MODELS.has(model)) {
    const error = new Error('GROQ_MODEL_RETIRED_FOR_FREE_TIER');
    error.code = 'GROQ_MODEL_RETIRED_FOR_FREE_TIER';
    throw error;
  }
  if (!FREE_GROQ_MODELS.includes(model)) {
    const error = new Error('GROQ_MODEL_NOT_ALLOWLISTED_FREE_TIER');
    error.code = 'GROQ_MODEL_NOT_ALLOWLISTED_FREE_TIER';
    throw error;
  }
  return model;
}

function isGroqConfigured(env = process.env) {
  return Boolean(typeof env.GROQ_API_KEY === 'string' && env.GROQ_API_KEY.trim());
}

module.exports = {
  DEFAULT_FREE_GROQ_MODEL,
  FREE_GROQ_MODELS,
  RETIRED_GROQ_MODELS,
  resolveFreeGroqModel,
  isGroqConfigured,
};
