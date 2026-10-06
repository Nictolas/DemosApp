const Groq = require('groq-sdk');

const SECURITY_AI_GROQ_PROVIDER_VERSION = 'v0.78';
const DEFAULT_MAX_TOKENS = 600;
const MAX_PROMPT_BYTES = 32 * 1024;

function safeId(value, max = 96) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_./:\-]/g, '_').slice(0, max);
}

function boundedInt(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function validGroqKey(value) {
  return typeof value === 'string' && /^gsk_[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

function buildGroqSecurityProviderConfig(env = {}) {
  const provider = safeId(env.SECURITY_AI_PROVIDER);
  const region = safeId(env.SECURITY_AI_REGION);
  const model = safeId(env.SECURITY_AI_MODEL, 120);
  const maxTokens = boundedInt(env.SECURITY_AI_GROQ_MAX_TOKENS, DEFAULT_MAX_TOKENS, 64, 2000);
  const requestCostEstimateMicros = boundedInt(env.SECURITY_AI_GROQ_REQUEST_COST_ESTIMATE_MICROS, 0, 1, 1_000_000_000);
  const apiKeyPresent = Boolean(env.GROQ_API_KEY);
  const apiKeyValid = validGroqKey(env.GROQ_API_KEY);
  const blockers = [];
  if (provider !== 'groq') blockers.push('provider_not_groq');
  if (!region) blockers.push('region_missing');
  if (!model) blockers.push('model_missing');
  if (!apiKeyPresent) blockers.push('api_key_missing');
  else if (!apiKeyValid) blockers.push('api_key_invalid');
  if (requestCostEstimateMicros <= 0) blockers.push('cost_estimate_missing');
  return Object.freeze({
    version: SECURITY_AI_GROQ_PROVIDER_VERSION,
    provider: provider || null,
    region: region || null,
    model: model || null,
    maxTokens,
    requestCostEstimateMicros,
    apiKeyPresent,
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
}

function genericError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertSafeRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw genericError('AI_GROQ_REQUEST_INVALID');
  if (request.mode !== 'shadow') throw genericError('AI_GROQ_REQUEST_UNSAFE');
  const controls = request.input?.controls;
  if (!controls || controls.readOnly !== true || controls.toolAccess !== false || controls.writeAccess !== false || controls.secretsAccess !== false || controls.rawLogsAccess !== false) {
    throw genericError('AI_GROQ_REQUEST_UNSAFE');
  }
  if (!Array.isArray(request.tools) || request.tools.length !== 0) throw genericError('AI_GROQ_TOOLS_FORBIDDEN');
  const inputJson = JSON.stringify(request.input);
  if (Buffer.byteLength(inputJson, 'utf8') > MAX_PROMPT_BYTES) throw genericError('AI_GROQ_REQUEST_TOO_LARGE');
  return inputJson;
}

class SecurityAiGroqProvider {
  constructor({ config, client } = {}) {
    if (!config || config.ready !== true) throw genericError('AI_GROQ_PROVIDER_NOT_READY');
    if (!client?.chat?.completions || typeof client.chat.completions.create !== 'function') throw genericError('AI_GROQ_CLIENT_INVALID');
    this.config = config;
    this.client = client;
    this.provider = 'groq';
    this.region = config.region;
    this.model = config.model;
    this.simulated = false;
    this.toolAccess = false;
    this.writeAccess = false;
  }

  async estimateCostMicros(request = {}) {
    assertSafeRequest(request);
    return this.config.requestCostEstimateMicros;
  }

  async analyze(request = {}) {
    const inputJson = assertSafeRequest(request);
    const systemPolicy = Array.isArray(request.systemPolicy) ? request.systemPolicy.join('\n') : '';
    const system = [
      systemPolicy,
      'Return strict JSON only with exactly these keys: assessment, confidence, prioritySuggestion, summary, hypotheses, recommendedActions, requiresHumanReview.',
      'Do not include markdown, prose outside JSON, secrets, raw logs, personal identities, or tool calls.'
    ].filter(Boolean).join('\n');

    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: inputJson }
        ],
        response_format: { type: 'json_object' },
        reasoning_format: 'hidden',
        temperature: 0,
        max_tokens: this.config.maxTokens
      });
    } catch (_error) {
      throw genericError('AI_GROQ_PROVIDER_FAILED');
    }

    const output = completion?.choices?.[0]?.message?.content;
    if (typeof output !== 'string' || !output.trim() || output.length > 20_000) throw genericError('AI_GROQ_RESPONSE_INVALID');
    return Object.freeze({ output, costMicros: this.config.requestCostEstimateMicros });
  }
}

function createGroqSecurityAiProvider({ env = process.env, config = buildGroqSecurityProviderConfig(env), client = null } = {}) {
  if (config.ready !== true) return null;
  const resolvedClient = client || new Groq({ apiKey: env.GROQ_API_KEY });
  return new SecurityAiGroqProvider({ config, client: resolvedClient });
}

module.exports = {
  SECURITY_AI_GROQ_PROVIDER_VERSION,
  DEFAULT_MAX_TOKENS,
  MAX_PROMPT_BYTES,
  buildGroqSecurityProviderConfig,
  SecurityAiGroqProvider,
  createGroqSecurityAiProvider
};
