const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createResearchPublicRouter } = require('../routes/researchPublicRouter');

test('Research public router composes only allowlisted limiter+handler pairs', () => {
  const handlerCalls = [];
  const limiterCalls = [];
  const handlers = {
    issueChallenge: () => handlerCalls.push('challenge'),
    listPoliticalVectors: () => handlerCalls.push('political-vectors'),
    readOpinionVector: () => handlerCalls.push('read'),
    readAnswerAggregates: () => handlerCalls.push('aggregates')
  };
  const challengeLimiter = (req, res, next) => {
    limiterCalls.push('challenge');
    next();
  };
  const readLimiter = (req, res, next) => {
    limiterCalls.push('read');
    next();
  };

  const router = createResearchPublicRouter({
    handlers,
    challengeLimiter,
    readLimiter
  });

  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      stackLength: layer.route.stack.length
    }));

  assert.deepEqual(routes, [
    { path: '/v1/proof-challenges', methods: ['post'], stackLength: 2 },
    { path: '/v1/political-vectors', methods: ['post'], stackLength: 2 },
    { path: '/v1/opinion-vector/read', methods: ['post'], stackLength: 2 },
    { path: '/v1/answer-aggregates/read', methods: ['post'], stackLength: 2 }
  ]);
  assert.deepEqual(handlerCalls, []);
  assert.deepEqual(limiterCalls, []);
});

test('Research public router remains unmounted from research-app', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'research-app.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /researchPublicRouter|createResearchPublicRouter/);
});


test('Research public router fails closed without explicit runtime rate limiters', () => {
  const handlers = {
    issueChallenge() {},
    listPoliticalVectors() {},
    readOpinionVector() {},
    readAnswerAggregates() {}
  };

  assert.throws(
    () => createResearchPublicRouter({ handlers, readLimiter: (req, res, next) => next() }),
    /challenge rate limiter is required/i
  );
  assert.throws(
    () => createResearchPublicRouter({ handlers, challengeLimiter: (req, res, next) => next() }),
    /read rate limiter is required/i
  );
});

test('Research public router has no process-local rate-limit dependency', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'researchPublicRouter.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /researchRateLimiting|MemoryStore/);
});
