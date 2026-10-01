const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  RESEARCH_RATE_LIMIT_WINDOW_MS,
  RESEARCH_CHALLENGE_MAX,
  RESEARCH_READ_MAX,
  researchRateLimitOptions
} = require('../middleware/researchRateLimiting');

test('Research rate-limit policy is independent from Identity and does not bypass Bearer requests', () => {
  const challenge = researchRateLimitOptions({ max: RESEARCH_CHALLENGE_MAX });
  const read = researchRateLimitOptions({ max: RESEARCH_READ_MAX });

  assert.equal(RESEARCH_RATE_LIMIT_WINDOW_MS, 60000);
  assert.equal(challenge.max, 30);
  assert.equal(read.max, 60);
  assert.equal(challenge.skipSuccessfulRequests, false);
  assert.equal(read.skipSuccessfulRequests, false);
  assert.equal(Object.hasOwn(challenge, 'skip'), false);
  assert.equal(Object.hasOwn(read, 'skip'), false);

  const source = fs.readFileSync(
    path.join(__dirname, '..', 'middleware', 'researchRateLimiting.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /middleware\/auth|RateLimitService|DATABASE_URL|userId|accountId|authorization|Bearer|JWT/);
});

test('Research rate-limit response contains no IP, user or account identifier', () => {
  const options = researchRateLimitOptions({ max: 1 });
  const state = {};
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    }
  };

  options.handler({}, res);

  assert.equal(state.statusCode, 429);
  assert.deepEqual(state.body, { error: 'Research request rate limit exceeded' });
});
