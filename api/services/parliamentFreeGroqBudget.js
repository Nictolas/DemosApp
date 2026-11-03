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

function getRetryAfterSeconds(error) {
  const raw = typeof error?.headers?.get === 'function'
    ? error.headers.get('retry-after')
    : error?.headers?.['retry-after'];
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(Math.ceil(seconds), 86400)
    : 60;
}

function isProviderRateLimited(error) {
  return Number(error?.status || error?.statusCode) === 429;
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
    blockedUntil = Math.max(blockedUntil, now() + getRetryAfterSeconds(error) * 1000);
  }

  return { reserve, coolDownFrom429 };
}

const sharedFreeGate = createFreeBudgetGate();

async function requestFreeGroq(client, params) {
  const maxOutputTokens = params.max_completion_tokens || params.max_tokens;
  const admission = sharedFreeGate.reserve(params.messages, maxOutputTokens);
  if (!admission.allowed) return null;

  try {
    return await client.chat.completions.create(params);
  } catch (error) {
    if (isProviderRateLimited(error)) {
      sharedFreeGate.coolDownFrom429(error);
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
  createFreeBudgetGate,
  requestFreeGroq,
};
