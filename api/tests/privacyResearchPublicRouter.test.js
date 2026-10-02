const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createResearchPublicRouter } = require('../routes/researchPublicRouter');

test('Research public router composes only challenge/read limiter+handler pairs', () => {
  const handlerCalls = [];
  const limiterCalls = [];
  const handlers = {
    issueChallenge: () => handlerCalls.push('challenge'),
    readOpinionVector: () => handlerCalls.push('read')
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
    { path: '/v1/opinion-vector/read', methods: ['post'], stackLength: 2 }
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
