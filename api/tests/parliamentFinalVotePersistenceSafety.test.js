'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'aiExplanationService.js'), 'utf8');
  const row = {
    id: 93, titolo_votazione: 'Votazione finale DDL 123',
    descrizione_votazione: 'Testo ufficiale persistito nel database.', spiegazione: null
  };
  let providerCalls = 0, updateCalls = 0, selectCalls = 0, duringProvider = () => {}, providerPrompt = '';
  const pool = {
    query: async (sql, params) => {
      if (/^\s*SELECT titolo_votazione, spiegazione, descrizione_votazione FROM votazioni_parlamento/i.test(sql)) {
        selectCalls++;
        assert.deepEqual(Array.from(params), [row.id]);
        return { rows: [{ titolo_votazione: row.titolo_votazione, spiegazione: row.spiegazione,
          descrizione_votazione: row.descrizione_votazione }] };
      }
      if (/^\s*UPDATE votazioni_parlamento/i.test(sql)) {
        updateCalls++;
        assert.match(sql, /WHERE id = \$2 AND titolo_votazione = \$3/);
        assert.match(sql, /descrizione_votazione IS NOT DISTINCT FROM \$4/);
        assert.equal(params.length, 4);
        assert.match(sql, /\(spiegazione IS NULL OR spiegazione = ''\)/);
        assert.equal(params[1], row.id);
        if (params[2] !== row.titolo_votazione || params[3] !== row.descrizione_votazione ||
            (row.spiegazione !== null && row.spiegazione !== '')) {
          return { rowCount: 0 };
        }
        row.spiegazione = params[0];
        return { rowCount: 1 };
      }
      throw new Error('Unexpected query: ' + sql);
    }
  };
  class MockGroq { constructor(options) { assert.equal(options.maxRetries, 0); } }
  const deps = {
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
      requestFreeGroq: async (_client, params) => {
        providerCalls++;
        providerPrompt = params.messages[1].content;
        duringProvider();
        return { choices: [{ finish_reason: 'stop', message: { content: 'Testo generato sul DDL 123' } }] };
      },
      getSharedFreeQuotaStatus: () => ({ count: 0, limite: 120, rispettato: true }),
      classifyFreeGroqError: () => 'NETWORK_OR_UNKNOWN'
    },
    './parliamentAiSingleflight': { createSingleflight: () => (_id, fn) => fn() },
    './parliamentFinalVotePolicy': { isConfirmedFinalParliamentVote: () => true },
    '../config/database': { getPool: () => pool }
  };
  const output = { exports: {} };
  vm.runInNewContext(
    '(function(require,module,exports,process,console){' + source + '\n})',
    { Date, JSON, Promise }
  )(
    name => {
      assert.ok(name in deps, 'Unexpected import: ' + name);
      return deps[name];
    },
    output, output.exports,
    { env: { GROQ_API_KEY: 'synthetic-only' } },
    { log() {}, warn() {}, error() {} }
  );
  const generate = (title = 'Votazione finale DDL 123') =>
    output.exports.generaSpiegazioneVotazione(row.id, title, 'Documento ufficiale sintetico', 'Camera');
  return {
    row, generate, setDuringProvider: fn => { duringProvider = fn; },
    get providerCalls() { return providerCalls; },
    get updateCalls() { return updateCalls; },
    get selectCalls() { return selectCalls; },
    get providerPrompt() { return providerPrompt; }
  };
}

test('votation title mismatch is rejected before consuming any Free Groq quota', async () => {
  const h = harness();
  assert.equal(await h.generate('Votazione finale DDL 999'), null);
  assert.equal(h.selectCalls, 1);
  assert.equal(h.providerCalls, 0);
  assert.equal(h.updateCalls, 0);
  assert.equal(h.row.spiegazione, null);
});

test('the correct final vote is updated exactly once with title and empty-cache guards', async () => {
  const h = harness();
  assert.equal(await h.generate(), 'Testo generato sul DDL 123');
  assert.equal(h.providerCalls, 1);
  assert.equal(h.updateCalls, 1);
  assert.equal(h.row.spiegazione, 'Testo generato sul DDL 123');
  assert.equal(await h.generate(), 'Testo generato sul DDL 123');
  assert.equal(h.providerCalls, 1, 'existing cache must not consume another Groq request');
  assert.equal(h.updateCalls, 1);
});

test('a changed vote title during provider generation can never receive old AI content', async () => {
  const h = harness();
  h.setDuringProvider(() => { h.row.titolo_votazione = 'Votazione finale DDL 456'; });
  assert.equal(await h.generate(), null);
  assert.equal(h.providerCalls, 1);
  assert.equal(h.updateCalls, 1);
  assert.equal(h.row.spiegazione, null);
});

test('a manually written explanation during provider generation cannot be overwritten', async () => {
  const h = harness();
  h.setDuringProvider(() => { h.row.spiegazione = 'Spiegazione ufficiale già presente'; });
  assert.equal(await h.generate(), null);
  assert.equal(h.providerCalls, 1);
  assert.equal(h.updateCalls, 1);
  assert.equal(h.row.spiegazione, 'Spiegazione ufficiale già presente');
});

test('an updated official document cannot receive an in-flight explanation from old evidence', async () => {
  const h = harness();
  h.setDuringProvider(() => { h.row.descrizione_votazione = 'Testo ufficiale aggiornato nel database.'; });
  assert.equal(await h.generate(), null);
  assert.equal(h.providerCalls, 1);
  assert.equal(h.updateCalls, 1);
  assert.equal(h.row.spiegazione, null);
});

test('the persisted official text takes precedence over a stale caller document', async () => {
  const h = harness();
  assert.equal(await h.generate(), 'Testo generato sul DDL 123');
  assert.match(h.providerPrompt, /Testo ufficiale persistito nel database/);
  assert.doesNotMatch(h.providerPrompt, /Documento ufficiale sintetico/);
});
