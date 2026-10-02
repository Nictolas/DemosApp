const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_CHALLENGE_MAX,
  RESEARCH_READ_MAX,
  createResearchDistributedRateLimiters
} = require('../middleware/researchDistributedRateLimitingFactory');

test('Research distributed limiter factory fails closed without backend or strong secret', () => {
  assert.throws(
    () => createResearchDistributedRateLimiters({ keySecret: Buffer.alloc(32, 1) }),
    /backend\.increment is required/
  );
  assert.throws(
    () => createResearchDistributedRateLimiters({
      backend: { increment() {} },
      keySecret: Buffer.alloc(16)
    }),
    /at least 32 bytes/
  );
});

test('Research distributed limiter factory injects separate stores for challenge and read', () => {
  const options = [];
  const fakeRateLimit = (value) => {
    options.push(value);
    return { kind: 'limiter', max: value.max };
  };

  const result = createResearchDistributedRateLimiters({
    backend: { async increment() { return { totalHits: 1, resetTime: new Date() }; } },
    keySecret: Buffer.alloc(32, 9),
    rateLimitFactory: fakeRateLimit
  });

  assert.deepEqual(result.researchChallengeLimiter, { kind: 'limiter', max: RESEARCH_CHALLENGE_MAX });
  assert.deepEqual(result.researchReadLimiter, { kind: 'limiter', max: RESEARCH_READ_MAX });
  assert.equal(options.length, 2);
  assert.equal(options[0].store.namespace, 'challenge');
  assert.equal(options[1].store.namespace, 'read');
  assert.notEqual(options[0].store, options[1].store);
  assert.equal(options[0].legacyHeaders, false);
  assert.equal(options[1].legacyHeaders, false);
});

test('Research distributed limiter stores pseudonymize the same raw key differently by scope', () => {
  const options = [];
  createResearchDistributedRateLimiters({
    backend: { async increment() { return { totalHits: 1, resetTime: new Date() }; } },
    keySecret: Buffer.alloc(32, 5),
    rateLimitFactory: (value) => {
      options.push(value);
      return value;
    }
  });

  const rawKey = '198.51.100.12';
  assert.notEqual(options[0].store.opaqueKey(rawKey), options[1].store.opaqueKey(rawKey));
  assert.equal(options[0].store.opaqueKey(rawKey).includes(rawKey), false);
  assert.equal(options[1].store.opaqueKey(rawKey).includes(rawKey), false);
});
