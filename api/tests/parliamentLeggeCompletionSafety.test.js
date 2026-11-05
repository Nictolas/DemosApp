'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('truncated or filtered Groq JSON never enters parliamentary analysis cache', async () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'leggeAnalysisService.js'), 'utf8'
  );
  let completion, insertCount = 0, providerCalls = 0, cacheMode = 'success';
  const parsedResult = {
    spiegazione_generale: 'Spiegazione basata sul documento ufficiale.',
    effetti_positivi: '',
    effetti_negativi: ''
  };
  const pool = {
    query: async (sql) => {
      if (/INSERT INTO parlamento_analisi_legge/.test(sql)) {
        insertCount++;
        if (cacheMode === 'throw') throw new Error('synthetic SQL unavailable');
        return { rowCount: cacheMode === 'zero' ? 0 : 1 };
      }
      return { rows: [{ exists: true }] };
    }
  };
  class FakeGroq {
    constructor(opts) {
      assert.equal(opts.maxRetries, 0);
    }
  }
  const deps = {
    'groq-sdk': FakeGroq,
    './parliamentFreeAiPolicy': {
      resolveFreeGroqModel: () => 'openai/gpt-oss-120b',
      isGroqConfigured: () => true
    },
    './parliamentGroundedAnalysis': {
      buildGroundedAnalysisMessages: () => [{ role: 'user', content: 'Documento ufficiale completo' }],
      parseGroundedAnalysisResponse: body => body ? parsedResult : null
    },
    './parliamentFreeGroqBudget': {
      requestFreeGroq: async (_client, params) => {
        providerCalls++;
        assert.equal(params.model, 'openai/gpt-oss-120b');
        assert.equal(params.reasoning_effort, 'low');
        return completion;
      },
      classifyFreeGroqError: () => 'NETWORK_OR_UNKNOWN'
    },
    './parliamentAiSingleflight': {
      createSingleflight: () => (_id, fn) => fn()
    },
    './parliamentActIdentifier': {
      estraiNumeroLegge: () => null,
      canSearchActTitle: () => false
    },
    '../config/database': { getPool: () => pool }
  };
  const output = { exports: {} };
  vm.runInNewContext(
    '(function(require,module,exports,process,console){' + source + '\n})',
    { JSON, Date }
  )(
    name => {
      assert.ok(name in deps, 'Unexpected dependency: ' + name);
      return deps[name];
    },
    output, output.exports,
    { env: { GROQ_API_KEY: 'mock-only' } },
    { log() {}, warn() {}, error() {} }
  );

  for (const reason of ['length', 'content_filter', null, 'tool_calls']) {
    completion = {
      choices: [{ finish_reason: reason, message: {
        content: JSON.stringify(parsedResult) // deliberately valid JSON despite truncation
      } }]
    };
    const result = await output.exports.generaAnalisiLegge(
      'urn:test:' + String(reason),
      { titolo: 'DDL 123', descrizione: 'x'.repeat(200), camera: 'Camera' }
    );
    assert.equal(result, null, 'No cache write for finish_reason=' + reason);
  }
  assert.equal(insertCount, 0, 'Invalid completions never reach INSERT');

  completion = {
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(parsedResult) } }]
  };
  const result = await output.exports.generaAnalisiLegge(
    'urn:test:ok',
    { titolo: 'DDL 123', descrizione: 'x'.repeat(200), camera: 'Camera' }
  );
  assert.equal(result.spiegazione_generale, parsedResult.spiegazione_generale);
  assert.equal(insertCount, 1, 'Only normal completion is cached');
  assert.equal(providerCalls, 5);

  // Even a normally finished model response is not a completed operation
  // when the SQL cache write fails or confirms zero affected rows.
  for (const mode of ['throw', 'zero']) {
    cacheMode = mode;
    const unsuccessful = await output.exports.generaAnalisiLegge(
      'urn:test:cache-' + mode,
      { titolo: 'DDL 123', descrizione: 'x'.repeat(200), camera: 'Camera' }
    );
    assert.equal(unsuccessful, null, 'No false success for SQL cache mode=' + mode);
  }
  assert.equal(insertCount, 3, 'Both failure modes attempt a single cache write');
  assert.equal(providerCalls, 7, 'Failed cache writes do not trigger provider retries');
});
