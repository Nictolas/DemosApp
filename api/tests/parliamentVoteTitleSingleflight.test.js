'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSingleflight } = require('../services/parliamentAiSingleflight');

test('a vote retitled while Groq is running cannot reuse the previous explanation', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/aiExplanationService.js'), 'utf8');
  const vote = { id: 523, titolo_votazione: 'Votazione finale A', spiegazione: null };
  let requests = 0;
  let releaseFirst;
  let signalFirst;
  const firstStarted = new Promise(resolve => { signalFirst = resolve; });
  const firstPending = new Promise(resolve => { releaseFirst = resolve; });

  const completion = content => ({
    choices: [{ finish_reason: 'stop', message: { content } }]
  });
  const pool = {
    query: async (sql, params) => {
      if (/^\s*SELECT titolo_votazione, spiegazione FROM votazioni_parlamento/u.test(sql)) {
        assert.equal(params[0], vote.id);
        return { rows: [{ titolo_votazione: vote.titolo_votazione, spiegazione: vote.spiegazione }] };
      }
      if (/^\s*UPDATE votazioni_parlamento/u.test(sql)) {
        assert.match(sql, /WHERE id = \$2 AND titolo_votazione = \$3/u);
        assert.equal(params[1], vote.id);
        if (params[2] !== vote.titolo_votazione || vote.spiegazione !== null) {
          return { rowCount: 0 };
        }
        vote.spiegazione = params[0];
        return { rowCount: 1 };
      }
      throw new Error('Unexpected query in vote-title regression test');
    }
  };
  class MockGroq {
    constructor(options) { assert.equal(options.maxRetries, 0); }
  }
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
      requestFreeGroq: async () => {
        requests++;
        if (requests === 1) {
          signalFirst();
          return firstPending;
        }
        return completion('Spiegazione della nuova votazione');
      },
      getSharedFreeQuotaStatus: () => ({ count: 0, limite: 120, rispettato: true }),
      classifyFreeGroqError: () => 'NETWORK_OR_UNKNOWN'
    },
    './parliamentAiSingleflight': { createSingleflight },
    './parliamentFinalVotePolicy': {
      isConfirmedFinalParliamentVote: () => true
    },
    '../config/database': { getPool: () => pool }
  };
  const moduleMock = { exports: {} };
  vm.runInNewContext('(function(require,module,exports,process,console){' + source + '\n})',
    { Promise, JSON, Date, setTimeout })(
    name => {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
    moduleMock, moduleMock.exports,
    { env: { GROQ_API_KEY: 'mock-not-real' } },
    { log() {}, warn() {}, error() {} }
  );

  const service = moduleMock.exports;
  const old = service.generaSpiegazioneVotazione(
    vote.id, 'Votazione finale A', 'Testo ufficiale fittizio lungo.', 'Camera'
  );
  await firstStarted;
  // This ID now refers to a different, newly indexed vote.
  vote.titolo_votazione = 'Votazione finale B';
  const current = service.generaSpiegazioneVotazione(
    vote.id, 'Votazione finale B', 'Nuovo testo ufficiale fittizio lungo.', 'Camera'
  );

  try {
    for (let step = 0; requests < 2 && step < 30; step++) {
      await Promise.resolve();
    }
    assert.equal(requests, 2, 'The new vote must start its own request before the old one finishes');
    assert.equal(await current, 'Spiegazione della nuova votazione');
    assert.equal(vote.spiegazione, 'Spiegazione della nuova votazione');
  } finally {
    releaseFirst(completion('Spiegazione ormai obsoleta'));
  }

  assert.equal(await old, null, 'The stale request must not overwrite the newly indexed vote');
  assert.equal(vote.spiegazione, 'Spiegazione della nuova votazione');
});
