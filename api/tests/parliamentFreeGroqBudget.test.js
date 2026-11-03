'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LIMIT,
  estimateReservedTokens,
  isProviderRateLimited,
  createFreeBudgetGate,
  requestFreeGroq
} = require('../services/parliamentFreeGroqBudget');

test('budget is conservative and shared across calls to the same gate', () => {
  let current = 1700000000000;
  const gate = createFreeBudgetGate({
    now: () => current,
    limits: { requestsPerMinute: 2, requestsPerDay: 3, estimatedTokensPerMinute: 3000, estimatedTokensPerDay: 6000 }
  });
  const messages = [{ role: 'user', content: 'Breve testo parlamentare' }];
  assert.ok(estimateReservedTokens(messages, 300) > 300);
  assert.deepEqual(gate.reserve(messages, 300), { allowed: true });
  assert.deepEqual(gate.reserve(messages, 300), { allowed: true });
  assert.deepEqual(gate.reserve(messages, 300), { allowed: false, reason: 'LOCAL_FREE_QUOTA_REACHED' });
  current += 61000;
  assert.deepEqual(gate.reserve(messages, 300), { allowed: true });
  assert.deepEqual(gate.reserve(messages, 300), { allowed: false, reason: 'LOCAL_FREE_QUOTA_REACHED' });
  current += 86400001;
  assert.deepEqual(gate.reserve(messages, 300), { allowed: true });
});

test('rejects oversize completion and excessive estimated prompt tokens without an API call', () => {
  const gate = createFreeBudgetGate({
    now: () => 1700000000000,
    limits: { requestsPerMinute: 8, requestsPerDay: 120, estimatedTokensPerMinute: 1000, estimatedTokensPerDay: 100000 }
  });
  assert.deepEqual(gate.reserve([], 2000), { allowed: false, reason: 'OUTPUT_TOKEN_LIMIT' });
  assert.deepEqual(gate.reserve([{ role: 'user', content: 'a'.repeat(5000) }], 850),
    { allowed: false, reason: 'LOCAL_FREE_QUOTA_REACHED' });
});

test('429 enforces provider cooldown instead of repeating calls', () => {
  let current = 1700000000000;
  const gate = createFreeBudgetGate({ now: () => current });
  const messages = [{ role: 'user', content: 'testo' }];
  assert.equal(isProviderRateLimited({ status: 429 }), true);
  assert.equal(isProviderRateLimited({ status: 500 }), false);
  gate.coolDownFrom429({ status: 429, headers: { 'retry-after': '180' } });
  assert.deepEqual(gate.reserve(messages, 450), { allowed: false, reason: 'PROVIDER_429_COOLDOWN' });
  current += 179999;
  assert.equal(gate.reserve(messages, 450).allowed, false);
  current += 2;
  assert.equal(gate.reserve(messages, 450).allowed, true);
});

test('wrapper does not call a provider when local budget is exhausted', async () => {
  let calls = 0;
  const client = { chat: { completions: { create: async () => { calls++; return { choices: [] }; } } } };
  const gate = { reserve: () => ({ allowed: false, reason: 'LOCAL_FREE_QUOTA_REACHED' }), coolDownFrom429() {} };
  assert.equal(await requestFreeGroq(client, { messages: [], max_completion_tokens: 450 }, gate), null);
  assert.equal(calls, 0);
});

test('wrapper does not retry 429 and fails gracefully', async () => {
  let calls = 0, cooldowns = 0;
  const client = { chat: { completions: { create: async () => {
    calls++;
    throw { status: 429, headers: { 'retry-after': '20' } };
  } } } };
  const gate = { reserve: () => ({ allowed: true }), coolDownFrom429: () => { cooldowns++; } };
  assert.equal(await requestFreeGroq(client, { messages: [], max_completion_tokens: 450 }, gate), null);
  assert.equal(calls, 1);
  assert.equal(cooldowns, 1);
});

test('only 429s are swallowed; other provider faults still surface', async () => {
  const client = { chat: { completions: { create: async () => { throw new Error('server unavailable'); } } } };
  const gate = { reserve: () => ({ allowed: true }), coolDownFrom429() {} };
  await assert.rejects(() => requestFreeGroq(client, { messages: [], max_completion_tokens: 450 }, gate), /server unavailable/);
});

test('both parliamentary services use quota wrapper without SDK auto-retry', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const name of ['aiExplanationService.js', 'leggeAnalysisService.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'services', name), 'utf8');
    assert.match(source, /requestFreeGroq\(aiClient/);
    assert.match(source, /maxRetries: 0/);
    assert.doesNotMatch(source, /aiClient\.chat\.completions\.create\(/);
  }
  const law = fs.readFileSync(path.join(__dirname, '..', 'services', 'leggeAnalysisService.js'), 'utf8');
  assert.match(law, /response_format: \{ type: 'json_object' \}/);
});
