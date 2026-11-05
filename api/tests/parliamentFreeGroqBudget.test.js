'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LIMIT,
  estimateReservedTokens,
  isProviderRateLimited,
  classifyFreeGroqError,
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

test('status reports local Free quota and clears after 24 hours', () => {
  let current = 1700000000000;
  const gate = createFreeBudgetGate({
    now: () => current,
    limits: { requestsPerMinute: 5, requestsPerDay: 1, estimatedTokensPerMinute: 5000, estimatedTokensPerDay: 9000 }
  });
  assert.deepEqual(gate.status(), {
    count: 0, limite: 1, rispettato: true, estimatedTokensToday: 0,
    tokenLimit: 9000, scope: 'PROCESS_LOCAL_BEST_EFFORT'
  });
  assert.equal(gate.reserve([{ role: 'user', content: 'test' }], 450).allowed, true);
  assert.equal(gate.status().count, 1);
  assert.equal(gate.status().rispettato, false);
  current += 86400001;
  assert.equal(gate.status().count, 0);
  assert.equal(gate.status().rispettato, true);
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


test('GPT-OSS completion truncation diagnostics and adequate output budget are present', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'aiExplanationService.js'), 'utf8');
  assert.match(source, /max_completion_tokens:\s*1024/);
  assert.match(source, /reasoning_effort:\s*'low'/);
  assert.match(source, /choice\?\.finish_reason === 'length'/);
  assert.match(source, /choice\?\.finish_reason === 'content_filter'/);
  assert.match(source, /typeof rawContent === 'string' \? rawContent\.trim\(\) : ''/);
  assert.doesNotMatch(source, /completion\.choices\[0\]\?\.message\?\.content\?\.trim\(\)/);
});


test('mocked GPT-OSS completion never publishes empty, truncated or filtered text', async () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'aiExplanationService.js'), 'utf8');
  let providerAnswer = null;
  let providerCalls = 0;
  let lastParams = null;
  const output = { exports: {} };
  class MockGroq {
    constructor() {
      this.chat = { completions: { create: async (params) => {
        providerCalls++;
        lastParams = params;
        return providerAnswer;
      } } };
    }
  }
  const imports = {
    'groq-sdk': MockGroq,
    '../config/database': { getPool: () => ({ query: async () => ({ rows: [] }) }) },
    './parliamentFreeAiPolicy': {
      resolveFreeGroqModel: () => 'openai/gpt-oss-120b',
      isGroqConfigured: () => true
    },
    './parliamentFinalVotePolicy': { isConfirmedFinalParliamentVote: () => true },
    './parliamentGroundedAnalysis': { hasDocumentaryContext: () => true },
    './parliamentFreeGroqBudget': {
      requestFreeGroq: (client, params) => client.chat.completions.create(params),
      getSharedFreeQuotaStatus: () => ({ rispettato: true, count: 0, limite: 120 })
    },
    './parliamentAiSingleflight': { createSingleflight: () => (_key, fn) => fn() }
  };
  const safeConsole = { log() {}, warn() {}, error() {} };
  const fakeRequire = (request) => {
    if (!(request in imports)) throw new Error('Unexpected require: ' + request);
    return imports[request];
  };
  const wrapper = vm.runInNewContext('(function(require, module, exports, process, console) {\n' + source + '\n})');
  wrapper(fakeRequire, output, output.exports, { env: { GROQ_API_KEY: 'mock-only' } }, safeConsole);
  const run = () => output.exports.generaSpiegazione(
    'DDL 123', 'Testo ufficiale completo e verificato per il test.', 'Camera', 'N/A'
  );

  providerAnswer = { choices: [{ finish_reason: 'length', message: { content: 'Testo parziale non verificato' } }] };
  assert.equal(await run(), null);
  providerAnswer = { choices: [{ finish_reason: 'content_filter', message: { content: 'Contenuto da escludere' } }] };
  assert.equal(await run(), null);
  providerAnswer = { choices: [{ finish_reason: 'stop', message: { content: '' } }] };
  assert.equal(await run(), null);
  providerAnswer = { choices: [{ finish_reason: 'stop', message: { content: 'Spiegazione fondata. ' } }] };
  assert.equal(await run(), 'Spiegazione fondata.');
  assert.equal(providerCalls, 4);
  assert.equal(lastParams.model, 'openai/gpt-oss-120b');
  assert.equal(lastParams.max_completion_tokens, 1024);
  assert.equal(lastParams.reasoning_effort, 'low');
});

test('Groq error diagnostics never log raw provider errors', () => {
  const dangerous = { status: 401, message: 'secret gsk_EXAMPLE_SUPER_SECRET_DO_NOT_PRINT', stack: 'secret stack' };
  assert.equal(classifyFreeGroqError(dangerous), 'AUTH');
  assert.equal(classifyFreeGroqError({ status: 403 }), 'AUTH');
  assert.equal(classifyFreeGroqError({ status: 400 }), 'INVALID_REQUEST');
  assert.equal(classifyFreeGroqError({ status: 404 }), 'MODEL_NOT_FOUND');
  assert.equal(classifyFreeGroqError({ status: 429 }), 'RATE_LIMIT');
  assert.equal(classifyFreeGroqError({ status: 503 }), 'PROVIDER_UNAVAILABLE');
  assert.equal(classifyFreeGroqError({ code: 'UNEXPECTED_TOKEN_IN_MESSAGE' }), 'NETWORK_OR_UNKNOWN');
  assert.doesNotMatch(classifyFreeGroqError(dangerous), /gsk_|secret/);
});

test('parliament AI routes and services hide provider messages and stack traces', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const services = ['aiExplanationService.js', 'leggeAnalysisService.js'];
  for (const name of services) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', name), 'utf8');
    assert.match(src, /classifyFreeGroqError\(error\)/);
    assert.doesNotMatch(src, /error\.stack/);
    assert.doesNotMatch(src, /console\.error\([^\n]*error\.message/);
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'voti-camera.js'), 'utf8');
  const start = src.indexOf("router.post('/votazione/:votazione_id/spiegazione'");
  const end = src.indexOf("// POST /api/voti-camera/genera-spiegazioni");
  assert.ok(start !== -1 && end > start);
  const guarded = src.slice(start, end);
  assert.doesNotMatch(guarded, /genError\.message|genError\.stack|error\.stack|message:\s*error\.message/);
  assert.match(guarded, /classifyFreeGroqError\(genError\)/);
  assert.match(guarded, /res\.status\(503\)\.json/);
});


test('both explanation handlers return a safe 503 without provider secrets', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'voti-camera.js'), 'utf8');
  const start = source.indexOf("router.post('/votazione/:votazione_id/spiegazione'");
  const end = source.indexOf("// POST /api/voti-camera/genera-spiegazioni");
  assert.ok(start >= 0 && end > start);
  const registered = new Map();
  const logs = [];
  const safeConsole = {
    log: (...v) => logs.push(v.join(' ')),
    warn: (...v) => logs.push(v.join(' ')),
    error: (...v) => logs.push(v.join(' '))
  };
  const injectedError = new Error('provider rejected gsk_SECRET_VALUE');
  injectedError.status = 401;
  injectedError.stack = 'PRIVATE_PROVIDER_STACK gsk_SECRET_VALUE';
  let shouldThrow = true;
  let isFinal = true;
  const fakeRequire = (name) => {
    if (name === '../services/aiExplanationService') return {
      verificaLimiteGiornaliero: async () => ({ rispettato: true, count: 0, limite: 120 }),
      generaSpiegazioneVotazione: async () => {
        if (shouldThrow) throw injectedError;
        return null;
      }
    };
    if (name === '../services/parliamentFreeGroqBudget') return {
      classifyFreeGroqError
    };
    throw new Error('unexpected require ' + name);
  };
  const pool = { query: async () => ({ rows: [{
    id: 3, titolo_votazione: isFinal ? 'Votazione finale DDL test' : 'Articolo 1 DDL test', descrizione_votazione: 'Fatti pubblici documentati',
    camera: 'Camera', spiegazione: null, votazione_id: 3
  }] }) };
  vm.runInNewContext(source.slice(start, end), {
    router: { post: (route, _auth, _admin, handler) => registered.set(route, handler) },
    verifyToken() {}, requireAdmin() {}, pool,
    require: fakeRequire, isConfirmedFinalParliamentVote: require('../services/parliamentFinalVotePolicy').isConfirmedFinalParliamentVote, console: safeConsole, Date, parseInt, isNaN, decodeURIComponent
  });
  for (const [route, params] of [
    ['/votazione/:votazione_id/spiegazione', { votazione_id: '3' }],
    ['/:politico/spiegazione', { politico: 'Nome%20Cognome' }]
  ]) {
    const handler = registered.get(route);
    assert.equal(typeof handler, 'function');
    for (const throwError of [true, false]) {
      shouldThrow = throwError;
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
      };
      await handler({ params }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /non (?:è )?disponibile/);
      assert.doesNotMatch(JSON.stringify(res.body), /gsk_|PRIVATE_PROVIDER_STACK|provider rejected|OPENAI_API_KEY/);
    }
  }
  // The final-vote gate must also protect the legacy URL.
  isFinal = false;
  for (const [route, params] of [
    ['/votazione/:votazione_id/spiegazione', { votazione_id: '3' }],
    ['/:politico/spiegazione', { politico: 'Nome%20Cognome' }]
  ]) {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await registered.get(route)({ params }, res);
    assert.equal(res.statusCode, 422);
    assert.match(res.body.error, /non finale/i);
  }
  assert.doesNotMatch(logs.join('\n'), /gsk_|PRIVATE_PROVIDER_STACK|provider rejected/);
  assert.match(logs.join('\n'), /AUTH/);
});


test('background explanation errors cannot expose provider credentials', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'sync-voti-openpolis.js'), 'utf8');
  const start = source.indexOf("generaSpiegazioneVotazione(votazioneId, votazione,");
  assert.ok(start > 0, 'background explanation call must be present');
  const catchBlock = source.slice(start, start + 550);
  assert.match(catchBlock, /classifyFreeGroqError\(error\)/);
  assert.doesNotMatch(catchBlock, /error\.message|error\.stack|,\s*error\s*\)/);
  assert.doesNotMatch(catchBlock, /OPENAI_API_KEY/);
});
