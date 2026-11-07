'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'voti-camera.js'), 'utf8'
);

function createBatchRouteHarness(aiService) {
  const postRoutes = new Map();
  const errors = [];
  const router = {
    get() { return this; },
    put() { return this; },
    delete() { return this; },
    post(route, ...handlers) {
      postRoutes.set(route, handlers[handlers.length - 1]);
      return this;
    }
  };
  const dependencies = {
    express: { Router: () => router },
    '../middleware/auth': { verifyToken() {}, requireAdmin() {} },
    '../config/database': {
      getPool: () => ({
        query: async () => { throw new Error('Unexpected SQL in isolated AI test'); }
      })
    },
    '../services/accountCapabilitiesService': { queryWithAccountModelFallback() {} },
    '../services/privacyErasureLedgerService': {},
    '../services/parliamentFinalVotePolicy': {
      isConfirmedFinalParliamentVote: () => true
    },
    '../services/aiExplanationService': aiService
  };
  const mod = { exports: {} };
  const safeConsole = {
    log() {},
    warn() {},
    error(...args) { errors.push(args); }
  };
  vm.runInNewContext(
    '(function(require,module,exports,console){' + routeSource + '\n})',
    { Date, setTimeout }
  )(
    name => {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
    mod,
    mod.exports,
    safeConsole
  );
  const handler = postRoutes.get('/genera-spiegazioni');
  assert.equal(typeof handler, 'function');

  async function request() {
    const response = {
      statusCode: 200,
      body: null,
      status(statusCode) { this.statusCode = statusCode; return this; },
      json(body) { this.body = body; return this; }
    };
    await handler({ body: { limit: 1 } }, response);
    return response;
  }
  return { errors, request };
}

test('AI explanation routes never log raw identifiers or exceptions', () => {
  const aiRoutes = routeSource.slice(routeSource.indexOf(
    '// POST /api/voti-camera/votazione/:votazione_id/spiegazione'
  ));
  assert.ok(aiRoutes.length > 1000, 'The selected route region must exist');
  assert.doesNotMatch(
    aiRoutes,
    /console\.(?:log|warn|error)\([^\n]*\$\{(?:req\.params\.[^}]+|votazioneId|votazione_id|politicoNome)\}/u
  );
  assert.doesNotMatch(
    aiRoutes,
    /console\.error\([^\n]*,\s*(?:error|genError)\)/u
  );
  assert.doesNotMatch(aiRoutes, /message:\s*error\.message/u);
});

test('batch AI startup failure gives only a generic response and generic logs', async () => {
  const sensitive = 'SECRET_TEST_CONNECTION_STRING_NOT_FOR_OUTPUT';
  const harness = createBatchRouteHarness({
    verificaLimiteGiornaliero: async () => { throw new Error(sensitive); }
  });
  const response = await harness.request();
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /temporaneamente non disponibile/u);
  assert.doesNotMatch(JSON.stringify(response.body), /SECRET_TEST_CONNECTION_STRING/u);
  assert.doesNotMatch(JSON.stringify(harness.errors), /SECRET_TEST_CONNECTION_STRING/u);
});

test('rejected batch AI work never logs provider errors or secrets', async () => {
  const sensitive = 'SECRET_TEST_GROQ_PROVIDER_PAYLOAD_NOT_FOR_LOGS';
  let rejectJob;
  const pendingJob = new Promise((_resolve, reject) => { rejectJob = reject; });
  const harness = createBatchRouteHarness({
    verificaLimiteGiornaliero: async () => ({
      rispettato: true, count: 0, limite: 120
    }),
    generaSpiegazioniMancanti: () => pendingJob
  });

  const response = await harness.request();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  rejectJob(new Error(sensitive));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(harness.errors.length, 1);
  assert.doesNotMatch(JSON.stringify(harness.errors), /SECRET_TEST_GROQ_PROVIDER_PAYLOAD/u);
});
