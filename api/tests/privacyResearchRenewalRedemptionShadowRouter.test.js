const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  RESEARCH_RENEWAL_MAX
} = require('../middleware/researchRateLimiting');
const {
  RESEARCH_RENEWAL_REDEMPTION_SHADOW_PATH,
  createResearchRenewalRedemptionShadowRouter
} = require('../routes/researchRenewalRedemptionShadowRouter');

const makeResponse = () => ({
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
});

const validBody = () => ({
  credential: Buffer.alloc(64, 7).toString('base64url'),
  epoch: '2026-Q4',
  participantPublicKey: Buffer.alloc(32, 8).toString('base64url'),
  challenge: Buffer.alloc(32, 9).toString('base64url'),
  signature: Buffer.alloc(64, 10).toString('base64url')
});

test('renewal redemption shadow route combines opaque credential and participant proof without leaking redemption metadata', async () => {
  const pool = { name: 'research-shadow-pool' };
  const credentialVerifier = { name: 'credential-verifier' };
  const participantProofVerifier = { name: 'participant-proof-verifier' };
  const renewalLimiter = (req, res, next) => next();
  let captured = null;

  const redeemRenewal = async (client, payload, credentialAdapter, proofAdapter) => {
    captured = { client, payload, credentialAdapter, proofAdapter };
    return {
      redeemed: true,
      participant: {
        participant_id: 'must-not-leak',
        status: 'active'
      }
    };
  };

  const router = createResearchRenewalRedemptionShadowRouter({
    getPool: () => pool,
    renewalLimiter,
    redeemRenewal,
    credentialVerifier,
    participantProofVerifier
  });
  const layer = router.stack.find((entry) => entry.route);

  assert.equal(layer.route.path, RESEARCH_RENEWAL_REDEMPTION_SHADOW_PATH);
  assert.deepEqual(Object.keys(layer.route.methods), ['post']);
  assert.equal(layer.route.stack.length, 2);
  assert.equal(layer.route.stack[0].handle, renewalLimiter);
  assert.equal(RESEARCH_RENEWAL_MAX, 10);

  const response = makeResponse();
  await layer.route.stack[1].handle({ body: validBody() }, response);

  assert.equal(captured.client, pool);
  assert.equal(captured.credentialAdapter, credentialVerifier);
  assert.equal(captured.proofAdapter, participantProofVerifier);
  assert.equal(captured.payload.epoch, '2026-Q4');
  assert.equal(captured.payload.credentialBytes.length, 64);
  assert.equal(captured.payload.participantPublicKey.length, 32);
  assert.equal(captured.payload.signature.length, 64);
  assert.equal(captured.payload.challenge, validBody().challenge);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { renewed: true });
});

test('renewal redemption shadow route rejects Identity-shaped or incomplete payloads before redemption', async () => {
  let redeemCalls = 0;
  const router = createResearchRenewalRedemptionShadowRouter({
    getPool: () => ({}),
    renewalLimiter: (req, res, next) => next(),
    redeemRenewal: async () => {
      redeemCalls += 1;
      return { redeemed: true };
    }
  });
  const handler = router.stack.find((entry) => entry.route).route.stack[1].handle;

  const identityResponse = makeResponse();
  await handler({ body: { ...validBody(), accountId: 'identity-leak' } }, identityResponse);
  assert.equal(identityResponse.statusCode, 400);

  const incomplete = validBody();
  delete incomplete.signature;
  const incompleteResponse = makeResponse();
  await handler({ body: incomplete }, incompleteResponse);
  assert.equal(incompleteResponse.statusCode, 400);
  assert.equal(redeemCalls, 0);
});

test('renewal redemption shadow route rejects malformed credential material and genericizes failed redemption', async () => {
  let redeemCalls = 0;
  const redeemRenewal = async () => {
    redeemCalls += 1;
    return { redeemed: false, participant: null };
  };
  const router = createResearchRenewalRedemptionShadowRouter({
    getPool: () => ({}),
    renewalLimiter: (req, res, next) => next(),
    redeemRenewal
  });
  const handler = router.stack.find((entry) => entry.route).route.stack[1].handle;

  const malformed = validBody();
  malformed.credential = Buffer.alloc(16, 1).toString('base64url');
  const malformedResponse = makeResponse();
  await handler({ body: malformed }, malformedResponse);
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(redeemCalls, 0);

  const rejectedResponse = makeResponse();
  await handler({ body: validBody() }, rejectedResponse);
  assert.equal(redeemCalls, 1);
  assert.equal(rejectedResponse.statusCode, 400);
  assert.deepEqual(rejectedResponse.body, {
    error: 'Invalid or replayed Research renewal request'
  });
});

test('renewal redemption shadow route stays unmounted and has no Identity auth dependency', () => {
  const researchAppSource = fs.readFileSync(
    path.join(__dirname, '..', 'research-app.js'),
    'utf8'
  );
  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'researchRenewalRedemptionShadowRouter.js'),
    'utf8'
  );

  assert.doesNotMatch(
    researchAppSource,
    /researchRenewalRedemptionShadowRouter|createResearchRenewalRedemptionShadowRouter/
  );
  assert.doesNotMatch(
    routeSource,
    /middleware\/auth|jsonwebtoken|requireAuth|authenticate|authorization|Bearer|JWT/
  );
});
