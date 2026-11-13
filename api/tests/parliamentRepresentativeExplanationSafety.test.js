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
  let providerCalls = 0, updates = 0, providerPrompt = '';
  let duringProvider = () => {};
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
        assert.ok(params.length === 3 || params.length === 5);
        if (params.length === 5) {
          assert.ok(sql.includes('descrizione_votazione IS NOT DISTINCT FROM $4'));
          assert.ok(sql.includes('spiegazione IS NOT DISTINCT FROM $5'));
          if (row.descrizione_votazione !== params[3] || row.spiegazione !== params[4]) {
            return { rowCount: 0 };
          }
        }
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
      hasDocumentaryContext: value => typeof value === 'string' && value.trim().length >= 160,
      MAX_CONTEXT_CHARS: 9000
    },
    './parliamentFreeGroqBudget': {
      requestFreeGroq: async (_client, params) => {
        providerCalls++;
        providerPrompt = params.messages[1].content;
        duringProvider();
        return completion;
      },
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
    setDuringProvider: fn => { duringProvider = fn; },
    get providerPrompt() { return providerPrompt; },
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
      'Votazione finale A', h.row.descrizione_votazione, 'Camera', 'Favorevole'
    );
    assert.equal(result, null, 'Must reject finish_reason=' + reason);
  }
  h.setCompletion({
    choices: [{ finish_reason: 'stop', message: { content: 'Sintesi completata.' } }]
  });
  assert.equal(
    await h.service.generaSpiegazione('Votazione finale A', h.row.descrizione_votazione, 'Camera', 'Favorevole'),
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

test('plain-text explanation enforces the promised 100-word maximum before publishing or saving', async () => {
  const h = createHarness();
  const words = Array(100).fill('misura').join(' ');
  h.setCompletion({ choices: [{ finish_reason: 'stop', message: { content: words } }] });
  assert.equal(await h.service.generaSpiegazione(
    'Votazione finale A', h.row.descrizione_votazione, 'Camera', 'Favorevole'
  ), words, '100 words should remain acceptable');

  h.setCompletion({ choices: [{ finish_reason: 'stop', message: { content: words + ' eccedente' } }] });
  assert.equal(await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', 'Fonte fittizia', 'Camera', 'Favorevole', true
  ), null, '101 words should not be saved as a short explanation');
  assert.equal(h.updates, 0, 'Too-long summaries must never be written to the database');
  assert.equal(h.row.spiegazione, null);
});


test('legacy cached representative explanation is hidden when persisted evidence is absent', async () => {
  for (const stored of [null, '', 'Solo un titolo']) {
    const h = createHarness();
    h.row.spiegazione = 'Vecchia spiegazione senza fonte';
    h.row.descrizione_votazione = stored;
    assert.equal(await h.service.generaESalvaSpiegazione(
      'Rappresentante QA', 'Votazione finale A', 'Documento non verificato '.repeat(20),
      'Camera', 'Favorevole'
    ), null);
    assert.equal(h.providerCalls, 0);
    assert.equal(h.updates, 0);
    assert.equal(h.row.spiegazione, 'Vecchia spiegazione senza fonte');
  }
});

test('cached representative explanation remains readable with a sufficient stored source', async () => {
  const h = createHarness();
  h.row.spiegazione = 'Spiegazione già verificata';
  assert.equal(await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', null, 'Camera', 'Favorevole'
  ), 'Spiegazione già verificata');
  assert.equal(h.providerCalls, 0);
  assert.equal(h.updates, 0);
});

test('representative generation uses the persisted document, never caller-supplied text', async () => {
  const h = createHarness();
  const text = await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', 'Documento del chiamante '.repeat(20),
    'Camera', 'Favorevole', true
  );
  assert.equal(text, 'Sintesi della votazione A.');
  assert.match(h.providerPrompt, /Testo ufficiale fittizio sufficientemente lungo/);
  assert.doesNotMatch(h.providerPrompt, /Documento del chiamante/);
});

test('missing or short persisted document rejects representative generation before Groq', async () => {
  for (const stored of [null, '', 'Solo un titolo']) {
    const h = createHarness();
    h.row.descrizione_votazione = stored;
    assert.equal(await h.service.generaESalvaSpiegazione(
      'Rappresentante QA', 'Votazione finale A', 'Documento del chiamante '.repeat(20),
      'Camera', 'Favorevole', true
    ), null);
    assert.equal(h.providerCalls, 0);
    assert.equal(h.updates, 0);
    assert.equal(h.row.spiegazione, null);
  }
});

test('representative document changed during provider call never receives stale explanation', async () => {
  const h = createHarness();
  h.setDuringProvider(() => {
    h.row.descrizione_votazione = 'Nuovo testo ufficiale persistito. '.repeat(7);
  });
  assert.equal(await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', null, 'Camera', 'Favorevole', true
  ), null);
  assert.equal(h.providerCalls, 1);
  assert.equal(h.updates, 1);
  assert.equal(h.row.spiegazione, null);
});

test('representative explanation written during provider call is not overwritten', async () => {
  const h = createHarness();
  h.setDuringProvider(() => { h.row.spiegazione = 'Revisione manuale esistente'; });
  assert.equal(await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', null, 'Camera', 'Favorevole', true
  ), null);
  assert.equal(h.providerCalls, 1);
  assert.equal(h.row.spiegazione, 'Revisione manuale esistente');
});

test('forced representative regeneration still updates unchanged prior explanation', async () => {
  const h = createHarness();
  h.row.spiegazione = 'Vecchia spiegazione';
  assert.equal(await h.service.generaESalvaSpiegazione(
    'Rappresentante QA', 'Votazione finale A', null, 'Camera', 'Favorevole', true
  ), 'Sintesi della votazione A.');
  assert.equal(h.row.spiegazione, 'Sintesi della votazione A.');
  assert.equal(h.updates, 1);
});

test('explanation service logs do not disclose vote identifiers or Groq configuration diagnostics', () => {
  assert.doesNotMatch(sourceForLogSafety(), /console\.(?:log|warn|error)\(\s*`[^`]*\$\{votazioneId\}/);
  assert.doesNotMatch(sourceForLogSafety(), /console\.(?:log|warn|error)\(\s*`[^`]*\$\{(?:aiProvider|aiClient|!!process\.env\.GROQ_API_KEY)\}/);
});

function sourceForLogSafety() {
  return fs.readFileSync(path.join(__dirname, '..', 'services', 'aiExplanationService.js'), 'utf8');
}
