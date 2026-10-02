const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createResearchPublicIntegrationPoc
} = require('../researchPublicIntegrationPoc');

test('Research integration POC stays unmounted with exposure disabled', () => {
  const { mounted } = createResearchPublicIntegrationPoc({
    policy: { mountAllowed: false, allowedOrigins: ['https://app.example'] },
    boundary: (req, res, next) => next(),
    router: (req, res, next) => next(),
    errorHandler: (err, req, res, next) => next(err)
  });
  assert.equal(mounted, false);
});

test('Research integration POC composes boundary and router only when policy is explicitly enabled', () => {
  const calls = [];
  const { mounted } = createResearchPublicIntegrationPoc({
    policy: { mountAllowed: true, allowedOrigins: ['https://app.example'] },
    boundary: (req, res, next) => { calls.push('boundary'); next(); },
    router: (req, res) => { calls.push('router'); res.status(204).end(); },
    errorHandler: (err, req, res, next) => next(err)
  });
  assert.equal(mounted, true);
  assert.deepEqual(calls, []);
});
