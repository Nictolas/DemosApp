'use strict';

// Conservative *process-local* guard shared by both parliamentary Groq clients.
// The provider/account Free tier remains the final rate-limit authority.
// This cannot prove billing is disabled, nor coordinate across several processes
// or survive a restart: verify the actual Groq organization is on Free.
const LIMIT = Object.freeze({
  requestsPerMinute: 8,
  requestsPerDay: 120,
  estimatedTokensPerMinute: 7000,
  estimatedTokensPerDay: 150000,
});

function estimateReservedTokens(messages, maxOutputTokens) {
  const bytes = Buffer.byteLength(JSON.stringify(messages || []), 'utf8');
  // Deliberately overestimate likely token use; provider may count differently.
  return Math.ceil(bytes / 2) + maxOutputTokens;
}

function getRetryAfterSeconds(error, at = Date.now()) {
  const raw = typeof error?.headers?.get === 'function'
    ? error.headers.get('retry-after')
    : error?.headers?.['retry-after'];
  // Retry-After supports delta-seconds OR an HTTP-date (RFC 9110).
  // An HTTP-date must not silently fall back to 60 seconds and hammer a
  // Free-tier provider that requested a longer cooldown.
  const seconds = typeof raw === 'string' && raw.trim()
    ? Number(raw.trim())
    : NaN;
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(Math.ceil(seconds), 86400);
  }
  const deadline = typeof raw === 'string' ? Date.parse(raw) : NaN;
  if (Number.isFinite(deadline) && deadline > at) {
    return Math.min(Math.ceil((deadline - at) / 1000), 86400);
  }
  return 60;
}

function isProviderRateLimited(error) {
  return Number(error?.status || error?.statusCode) === 429;
}

// Report only an allowlisted diagnostic category. Provider error messages,
// stack traces, request payloads and response bodies may contain credentials
// or text from documents and must never enter application logs.
function classifyFreeGroqError(error) {
  const status = Number(error?.status || error?.statusCode);
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 404) return 'MODEL_NOT_FOUND';
  if (status === 400 || status === 422) return 'INVALID_REQUEST';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 500 && status <= 599) return 'PROVIDER_UNAVAILABLE';
  return 'NETWORK_OR_UNKNOWN';
}

function createFreeBudgetGate({ now = Date.now, limits = LIMIT } = {}) {
  let minute = [];
  let day = [];
  let blockedUntil = 0;

  function reserve(messages, maxOutputTokens) {
    const at = now();
    const output = Number(maxOutputTokens);
    if (!Number.isInteger(output) || output < 1 || output > 1500) {
      return { allowed: false, reason: 'OUTPUT_TOKEN_LIMIT' };
    }
    if (at < blockedUntil) return { allowed: false, reason: 'PROVIDER_429_COOLDOWN' };

    minute = minute.filter(x => at - x.time < 60000);
    day = day.filter(x => at - x.time < 86400000);
    const estimatedTokens = estimateReservedTokens(messages, output);
    const usedMinute = minute.reduce((total, x) => total + x.tokens, 0);
    const usedDay = day.reduce((total, x) => total + x.tokens, 0);

    if (minute.length >= limits.requestsPerMinute ||
        day.length >= limits.requestsPerDay ||
        usedMinute + estimatedTokens > limits.estimatedTokensPerMinute ||
        usedDay + estimatedTokens > limits.estimatedTokensPerDay) {
      return { allowed: false, reason: 'LOCAL_FREE_QUOTA_REACHED' };
    }

    // Synchronous reservation occurs before the async provider request:
    // concurrent calls share this process-level budget without a race.
    const entry = { time: at, tokens: estimatedTokens };
    minute.push(entry);
    day.push(entry);
    return { allowed: true };
  }

  function coolDownFrom429(error) {
    blockedUntil = Math.max(blockedUntil, now() + getRetryAfterSeconds(error, now()) * 1000);
  }

  function status() {
    const at = now();
    day = day.filter(x => at - x.time < 86400000);
    const estimatedTokensToday = day.reduce((total, x) => total + x.tokens, 0);
    return {
      count: day.length,
      limite: limits.requestsPerDay,
      rispettato: day.length < limits.requestsPerDay &&
        estimatedTokensToday < limits.estimatedTokensPerDay &&
        at >= blockedUntil,
      estimatedTokensToday,
      tokenLimit: limits.estimatedTokensPerDay,
      scope: 'PROCESS_LOCAL_BEST_EFFORT'
    };
  }

  return { reserve, coolDownFrom429, status };
}

const sharedFreeGate = createFreeBudgetGate();

function getSharedFreeQuotaStatus() {
  return sharedFreeGate.status();
}

async function requestFreeGroq(client, params, gate = sharedFreeGate) {
  const maxOutputTokens = params.max_completion_tokens || params.max_tokens;
  const admission = gate.reserve(params.messages, maxOutputTokens);
  if (!admission.allowed) return null;

  try {
    return await client.chat.completions.create(params);
  } catch (error) {
    if (isProviderRateLimited(error)) {
      gate.coolDownFrom429(error);
      return null; // no retry, no paid fallback; use the official voting data.
    }
    throw error;
  }
}

module.exports = {
  LIMIT,
  estimateReservedTokens,
  getRetryAfterSeconds,
  isProviderRateLimited,
  classifyFreeGroqError,
  createFreeBudgetGate,
  getSharedFreeQuotaStatus,
  requestFreeGroq,
};
