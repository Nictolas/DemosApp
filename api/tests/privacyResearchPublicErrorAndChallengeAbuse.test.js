const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_PUBLIC_ERROR_MAX_BYTES,
  buildResearchPublicError,
  sendResearchPublicError
} = require('../services/researchPublicErrorPolicy');
const {
  MAX_EXPIRED_CHALLENGE_PURGE_PER_ISSUE,
  issueResearchProofChallenge
} = require('../services/researchProofChallengeStore');
const {
  createLimiterOptions
} = require('../middleware/researchDistributedRateLimitingFactory');
const {
  createResearchPublicHandlers
} = require('../handlers/researchPublicHandlers');

const responseRecorder = () => {
  const state = { headers: {}, statusCode: null, body: null };
  return {
    state,
    res: {
      setHeader(name, value) { state.headers[name] = value; },
      status(code) { state.statusCode = code; return this; },
      json(body) { state.body = body; return this; }
    }
  };
};

test('Research public errors are minimal, bounded and privacy-headered', () => {
  for (const status of [400, 403, 413, 415, 429]) {
    const out = responseRecorder();
    sendResearchPublicError(out.res, status);
    assert.equal(out.state.statusCode, status);
    assert.deepEqual(out.state.body, buildResearchPublicError(status));
    assert.ok(Buffer.byteLength(JSON.stringify(out.state.body), 'utf8') <= RESEARCH_PUBLIC_ERROR_MAX_BYTES);
    assert.equal(out.state.headers['Cache-Control'], 'no-store');
    assert.equal(out.state.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(out.state.headers['Referrer-Policy'], 'no-referrer');
  }
  assert.deepEqual(buildResearchPublicError(400), buildResearchPublicError(403));
  assert.throws(() => buildResearchPublicError(500), /Unsupported Research public error status/);
});

test('Research distributed rate-limit rejection uses the same bounded public error policy', () => {
  const options = createLimiterOptions({
    max: 1,
    store: {},
    keyGenerator: () => 'client'
  });
  const out = responseRecorder();
  options.handler({}, out.res);
  assert.equal(out.state.statusCode, 429);
  assert.deepEqual(out.state.body, buildResearchPublicError(429));
  assert.equal(out.state.headers['Cache-Control'], 'no-store');
});

test('Research challenge issuance performs bounded indexed stale cleanup in the same database round trip', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    }
  };
  await issueResearchProofChallenge(client, {
    randomBytes: () => Buffer.alloc(32, 9)
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WITH stale_challenges AS/i);
  assert.match(calls[0].sql, /WHERE expires_at <= NOW\(\)/i);
  assert.match(calls[0].sql, /ORDER BY expires_at/i);
  assert.match(calls[0].sql, /LIMIT \$4/i);
  assert.match(calls[0].sql, /DELETE FROM research\.proof_challenges/i);
  assert.match(calls[0].sql, /INSERT INTO research\.proof_challenges/i);
  assert.equal(calls[0].params[3], MAX_EXPIRED_CHALLENGE_PURGE_PER_ISSUE);
  assert.equal(MAX_EXPIRED_CHALLENGE_PURGE_PER_ISSUE, 256);
});

test('Research challenge handler never returns backend exception details', async () => {
  const handlers = createResearchPublicHandlers({
    getPool: () => ({
      async query() {
        throw new Error('postgres host secret.internal.example credential=do-not-leak');
      }
    })
  });
  const out = responseRecorder();
  await handlers.issueChallenge({ body: {} }, out.res);
  assert.equal(out.state.statusCode, 400);
  assert.deepEqual(out.state.body, { error: 'Invalid Research request' });
  const serialized = JSON.stringify(out.state.body);
  assert.equal(serialized.includes('postgres'), false);
  assert.equal(serialized.includes('secret.internal'), false);
  assert.equal(out.state.headers['Cache-Control'], 'no-store');
});
