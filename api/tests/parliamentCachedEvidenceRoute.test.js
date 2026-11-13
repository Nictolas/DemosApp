'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'voti-camera.js'), 'utf8');

function harness(document) {
  const gets = new Map();
  const posts = new Map();
  let selectCalls = 0;
  let aiCalls = 0;

  const router = {
    get(route, ...handlers) { gets.set(route, handlers.at(-1)); return this; },
    post(route, ...handlers) { posts.set(route, handlers.at(-1)); return this; },
    put() { return this; },
    delete() { return this; }
  };
  const row = {
    id: 41,
    votazione_id: 41,
    titolo_votazione: 'Votazione finale DDL 41',
    titolo: 'Votazione finale DDL 41',
    camera: 'Camera',
    descrizione_votazione: document,
    descrizione: document,
    spiegazione: 'Sintesi legacy salvata senza verifica documentale',
    numero_politici: 1
  };
  const pool = {
    query: async sql => {
      assert.match(sql, /^\s*SELECT/u, 'Read-only route test must not write to DB');
      selectCalls++;
      if (sql.includes('FROM voti_camera vc') &&
          sql.includes('WHERE vc.votazione_id = $1')) return { rows: [] };
      if (sql.includes('FROM votazioni_parlamento vp') &&
          sql.includes('LEFT JOIN voti_camera')) return { rows: [row] };
      if (sql.includes('FROM votazioni_parlamento vp') &&
          sql.includes('WHERE vp.id = $1')) return { rows: [row] };
      if (sql.includes('FROM votazioni_parlamento') &&
          sql.includes('WHERE id = $1')) return { rows: [row] };
      if (sql.includes('FROM voti_camera vc') &&
          sql.includes('LEFT JOIN votazioni_parlamento vp')) return { rows: [row] };
      throw new Error('Unexpected SQL in read-only cache test');
    }
  };
  const dependencies = {
    express: { Router: () => router },
    '../middleware/auth': { verifyToken() {}, requireAdmin() {} },
    '../config/database': { getPool: () => pool },
    '../services/accountCapabilitiesService': {
      queryWithAccountModelFallback: async () => ({ rows: [row] })
    },
    '../services/privacyErasureLedgerService': {},
    '../services/parliamentFinalVotePolicy': { isConfirmedFinalParliamentVote: () => true },
    '../services/parliamentGroundedAnalysis': {
      hasDocumentaryContext: value => typeof value === 'string' &&
        value.replace(/\s+/gu, ' ').trim().length >= 160
    },
    '../services/aiExplanationService': {
      verificaLimiteGiornaliero: () => {
        aiCalls++;
        throw new Error('No Groq checks allowed for missing source');
      },
      generaSpiegazioneVotazione: () => {
        aiCalls++;
        throw new Error('No Groq calls allowed for missing source');
      }
    }
  };
  const moduleMock = { exports: {} };
  vm.runInNewContext(
    '(function(require,module,exports,console){' + source + '\n})',
    { Date, setTimeout }
  )(
    name => {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
    moduleMock, moduleMock.exports,
    { log() {}, warn() {}, error() {} }
  );
  assert.equal(moduleMock.exports, router);

  async function invoke(method, route) {
    const fn = (method === 'GET' ? gets : posts).get(route);
    assert.equal(typeof fn, 'function', route + ' registered');
    const response = {
      statusCode: 200,
      body: null,
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; }
    };
    await fn({ params: { votazione_id: '41', politico: 'QA' }, body: {} }, response);
    return response;
  }
  return {
    row,
    invoke,
    get selectCalls() { return selectCalls; },
    get aiCalls() { return aiCalls; }
  };
}

test('undocumented cached explanation is omitted from public lists and single vote detail', async () => {
  for (const document of [null, '', 'Una descrizione troppo breve']) {
    const h = harness(document);
    const list = await h.invoke('GET', '/votazioni');
    assert.equal(list.statusCode, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].spiegazione, null);

    const detail = await h.invoke('GET', '/votazione/:votazione_id');
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.body.data.spiegazione, null);
    assert.equal(h.selectCalls, 3, 'No additional source queries');
    assert.equal(h.aiCalls, 0);
  }
});

test('both admin explanation routes reject undocumented cache without Groq quota checks', async () => {
  for (const document of [null, 'Titolo senza testo normativo']) {
    const h = harness(document);
    for (const route of ['/votazione/:votazione_id/spiegazione', '/:politico/spiegazione']) {
      const response = await h.invoke('POST', route);
      assert.equal(response.statusCode, 503, route);
      assert.match(response.body.message, /testo documentale insufficiente/iu);
      assert.doesNotMatch(JSON.stringify(response.body), /Sintesi legacy/iu);
    }
    assert.equal(h.aiCalls, 0);
    assert.equal(h.selectCalls, 2);
  }
});

test('a sufficient stored document preserves existing explanation and avoids Groq calls', async () => {
  const h = harness('Testo parlamentare persistito per la votazione. '.repeat(6));
  const list = await h.invoke('GET', '/votazioni');
  assert.equal(list.body.data[0].spiegazione, h.row.spiegazione);
  const detail = await h.invoke('GET', '/votazione/:votazione_id');
  assert.equal(detail.body.data.spiegazione, h.row.spiegazione);
  for (const route of ['/votazione/:votazione_id/spiegazione', '/:politico/spiegazione']) {
    const response = await h.invoke('POST', route);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.spiegazione, h.row.spiegazione);
  }
  assert.equal(h.aiCalls, 0);
});
