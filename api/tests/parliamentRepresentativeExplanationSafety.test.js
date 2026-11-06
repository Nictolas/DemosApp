'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'aiExplanationService.js'), 'utf8'
  );
  const row = {
    politico_nome: 'Rappresentante QA',
    votazione: 'Votazione finale A',
    descrizione_votazione: 'Testo ufficiale fittizio sufficientemente lungo. '.repeat(6),
    spiegazione: null
  };
  let providerCalls = 0, updates = 0;
  let completion = {
    choices: [{ finish_reason: 'stop', message: { content: 'Sintesi della votazione A.' } }]
  };
  const pool = {
    query: async (sql, params) => {
      if (/^\s*SELECT spiegazione, descrizione_votazione FROM voti_camera/i.test(sql)) {
        assert.equal(params.length, 2);
        return { rows: row.politico_nome === params[0] && row.votazione === params[1]
          ? [{ spiegazione: row.spiegazione, descrizione_votazione: row.descrizione_votazione }] : [] };
      }
      if (/^\s*UPDATE voti_camera/i.test(sql)) {
        updates++;
        assert.match(sql, /WHERE\s+politico_nome\s*=\s*\$2\s+AND\s+votazione\s*=\s*\$3/i);
        assert.equal(params.length, 3);
        if (row.politico_nome === params[1] && row.votazione === params[2]) {
          row.spiegazione = params[0];
          return { rowCount: 1 };
        }
        return { rowCount: 0 };
      }
      throw new Error('Unexpected SQL in representative explanation test');
    }
  };
  class MockGroq { constructor(options) { assert.equal(options.maxRetries, 0); } }
  const dependencies = {
    'groq-sdk': MockGroq,
    './parliamentFreeAiPolicy': {
      resolveFreeGroqModel: () => 'openai/gpt-oss-120b',
      isGroqConfigured: () => true
    },
    './parliamentGroundedAnalysis': {
      hasDocumentaryContext: () => true,
      MAX_CONTEXT_CHARS: 9000
    },
    './parliamentFreeGroqBudget': {
      requestFreeGroq: async () => { providerCalls++; return completion; },
      getSharedFreeQuotaStatus: () => ({ count: 0, limite: 120, rispettato: true }),
      classifyFreeGroqError: () => 'NETWORK_OR_UNKNOWN'
    },
    './parliamentAiSingleflight': { createSingleflight: () => (_id, fn) => fn() },
    './parliamentFinalVotePolicy': { isConfirmedFinalParliamentVote: () => true },
    '../config/database': { getPool: () => pool }
  };
  const mod = { exports: {} };
  vm.runInNewContext(
    '(function(require,module,exports,process,console){' + source + '\n})',
    { Date, JSON, Promise }
  )(
    name => {
      assert.ok(name in dependencies, 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
    mod, mod.exports,
    { env: { GROQ_API_KEY: 'mock-not-real' } },
    { log() {}, warn() {}, error() {} }
  );
  return {
    row, service: mod.exports,
    get providerCalls() { return providerCalls; },
    get updates() { return updates; },
    setCompletion: val => { completion = val; },
    changeVote: title => { row.votazione = title; }
  };
}

test('representative save requires the exact vote title, never updates by name alone', async () => {
  const h = createHarness();
  const { service, row } = h;
  assert.equal(await service.salvaSpiegazione('Rappresentante QA', 'Sintesi sbagliata'), false);
  assert.equal(await service.salvaSpiegazione('Rappresentante QA', 'Sintesi sbagliata', 'Votazione finale B'), false);
  assert.equal(row.spiegazione, null);
  assert.equal(await service.salvaSpiegazione('Rappresentante QA', 'Sintesi corretta', 'Votazione finale A'), true);
  assert.equal(row.spiegazione, 'Sintesi corretta');
  assert.equal(h.updates, 2);
});

test('old vote is rejected before using Groq Free quota', async () => {
  const h = createHarness();
  const result = await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale B', 'Fonte fittizia', 'Camera', 'Favorevole', true
  );
  assert.equal(result, null);
  assert.equal(h.providerCalls, 0);
  assert.equal(h.updates, 0);
  assert.equal(h.row.spiegazione, null);
});

test('a voting row changed during AI generation cannot receive a stale explanation', async () => {
  const h = createHarness();
  h.setCompletion({
    choices: [{ finish_reason: 'stop', message: { content: 'Sintesi della votazione A.' } }]
  });
  const generation = h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', 'Fonte fittizia', 'Camera', 'Favorevole', true
  );
  // Change after SELECT but before provider completion / guarded UPDATE.
  h.changeVote('Votazione finale B');
  const result = await generation;
  assert.equal(result, null, 'Cannot return an unsaved explanation as saved');
  assert.equal(h.providerCalls, 1);
  assert.equal(h.row.spiegazione, null);
});

test('plain-text explanations reject all non-stop completions even when text is present', async () => {
  const h = createHarness();
  for (const reason of ['length', 'content_filter', 'tool_calls', null]) {
    h.setCompletion({
      choices: [{ finish_reason: reason, message: { content: 'Sintesi incompleta.' } }]
    });
    const result = await h.service.generaSpiegazione(
      'Votazione finale A', 'Fonte fittizia', 'Camera', 'Favorevole'
    );
    assert.equal(result, null, 'Must reject finish_reason=' + reason);
  }
  h.setCompletion({
    choices: [{ finish_reason: 'stop', message: { content: 'Sintesi completata.' } }]
  });
  assert.equal(
    await h.service.generaSpiegazione('Votazione finale A', 'Fonte fittizia', 'Camera', 'Favorevole'),
    'Sintesi completata.'
  );
});


test('insufficient-evidence sentinel is never published when punctuated or reformatted', async () => {
  const h = createHarness();
  const nonAnswers = [
    'INFORMAZIONI_INSUFFICIENTI',
    'INFORMAZIONI_INSUFFICIENTI.',
    ' informazioni_insufficienti! ',
    'Informazioni insufficienti.',
    'INFORMAZIONI-INSUFFICIENTI?',
    'INFORMAZIONI   INSUFFICIENTI'
  ];
  for (const content of nonAnswers) {
    h.setCompletion({ choices: [{ finish_reason: 'stop', message: { content } }] });
    const result = await h.service.generaESalvaSpiegazione(
      'Rappresentante QA', 'Votazione finale A', 'Fonte fittizia', 'Camera', 'Favorevole', true
    );
    assert.equal(result, null, 'Must not publish a no-evidence placeholder: ' + content);
    assert.equal(h.row.spiegazione, null);
  }
  assert.equal(h.updates, 0, 'No no-evidence sentinel may be saved in the database');
  assert.equal(h.providerCalls, nonAnswers.length);

  h.setCompletion({
    choices: [{ finish_reason: 'stop', message: {
      content: 'La proposta disciplina il procedimento descritto nel documento.'
    } }]
  });
  assert.equal(await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', 'Fonte fittizia', 'Camera', 'Favorevole', true
  ), 'La proposta disciplina il procedimento descritto nel documento.');
  assert.equal(h.updates, 1, 'Valid text still saves normally');
});

test('explanation service logs do not disclose vote identifiers or Groq configuration diagnostics', () => {
  assert.doesNotMatch(sourceForLogSafety(), /console\.(?:log|warn|error)\(\s*`[^`]*\$\{votazioneId\}/);
  assert.doesNotMatch(sourceForLogSafety(), /console\.(?:log|warn|error)\(\s*`[^`]*\$\{(?:aiProvider|aiClient|!!process\.env\.GROQ_API_KEY)\}/);
});

function sourceForLogSafety() {
  return fs.readFileSync(path.join(__dirname, '..', 'services', 'aiExplanationService.js'), 'utf8');
}
