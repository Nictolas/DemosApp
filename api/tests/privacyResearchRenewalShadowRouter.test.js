const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  RENEW_PARTICIPATION_PURPOSE
} = require('../services/researchParticipantProofPolicy');
const {
  RESEARCH_RENEWAL_SHADOW_CHALLENGE_PATH,
  createResearchRenewalShadowRouter
} = require('../routes/researchRenewalShadowRouter');

test('renewal challenge shadow route is public, rate-limited and isolated from Identity auth', async () => {
  const pool = { name: 'shadow-pool' };
  let issuedWith = null;
  const challengeLimiter = (req, res, next) => next();
  const issueChallenge = async (client) => {
    issuedWith = client;
    return {
      challenge: Buffer.alloc(32, 11).toString('base64url'),
      purpose: RENEW_PARTICIPATION_PURPOSE
    };
  };

  const router = createResearchRenewalShadowRouter({
    getPool: () => pool,
    challengeLimiter,
    issueChallenge
  });
  const layer = router.stack.find((entry) => entry.route);

  assert.equal(layer.route.path, RESEARCH_RENEWAL_SHADOW_CHALLENGE_PATH);
  assert.deepEqual(Object.keys(layer.route.methods), ['post']);
  assert.equal(layer.route.stack.length, 2);
  assert.equal(layer.route.stack[0].handle, challengeLimiter);

  const handler = layer.route.stack[1].handle;
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  await handler({ body: {} }, response);

  assert.equal(issuedWith, pool);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.purpose, RENEW_PARTICIPATION_PURPOSE);
});

test('renewal challenge shadow route rejects Identity-shaped payloads', async () => {
  let issueCalls = 0;
  const router = createResearchRenewalShadowRouter({
    getPool: () => ({}),
    challengeLimiter: (req, res, next) => next(),
    issueChallenge: async () => {
      issueCalls += 1;
      return { challenge: 'unused', purpose: RENEW_PARTICIPATION_PURPOSE };
    }
  });
  const handler = router.stack.find((entry) => entry.route).route.stack[1].handle;
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  await handler({ body: { accountId: 'identity-leak' } }, response);

  assert.equal(issueCalls, 0);
  assert.equal(response.statusCode, 400);
});

test('renewal challenge shadow route remains unmounted and contains no Identity auth dependency', () => {
  const researchAppSource = fs.readFileSync(
    path.join(__dirname, '..', 'research-app.js'),
    'utf8'
  );
  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'researchRenewalShadowRouter.js'),
    'utf8'
  );

  assert.doesNotMatch(
    researchAppSource,
    /researchRenewalShadowRouter|createResearchRenewalShadowRouter/
  );
  assert.doesNotMatch(
    routeSource,
    /middleware\/auth|jsonwebtoken|requireAuth|authenticate/
  );
});
