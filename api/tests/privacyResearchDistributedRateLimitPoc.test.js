const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_RATE_LIMIT_WINDOW_MS
} = require('../middleware/researchDistributedRateLimitingFactory');
const {
  createResearchDistributedRateLimitPoc
} = require('../researchDistributedRateLimitPoc');

const keyGenerator = (req) => req.ip;

test('Research distributed rate-limit POC composes one atomic backend into isolated challenge/read stores', async () => {
  const evalCalls = [];
  const limiterOptions = [];
  const evalScript = async (input) => {
    evalCalls.push(input);
    return [1, 60_000];
  };

  createResearchDistributedRateLimitPoc({
    evalScript,
    now: () => 1_000,
    keySecret: Buffer.alloc(32, 4),
    keyGenerator,
    rateLimitFactory: (options) => {
      limiterOptions.push(options);
      return options;
    }
  });

  assert.equal(limiterOptions.length, 2);
  assert.equal(limiterOptions[0].keyGenerator, keyGenerator);
  assert.equal(limiterOptions[1].keyGenerator, keyGenerator);
  assert.equal(limiterOptions[0].passOnStoreError, false);
  assert.equal(limiterOptions[1].passOnStoreError, false);

  const challengeStore = limiterOptions[0].store;
  const readStore = limiterOptions[1].store;

  assert.equal(challengeStore.backend, readStore.backend);
  assert.equal(challengeStore.namespace, 'challenge');
  assert.equal(readStore.namespace, 'read');

  challengeStore.init({ windowMs: RESEARCH_RATE_LIMIT_WINDOW_MS });
  readStore.init({ windowMs: RESEARCH_RATE_LIMIT_WINDOW_MS });

  await challengeStore.increment('198.51.100.77');
  await readStore.increment('198.51.100.77');

  assert.equal(evalCalls.length, 2);
  assert.notEqual(evalCalls[0].keys[0], evalCalls[1].keys[0]);
  assert.equal(evalCalls[0].keys[0].includes('198.51.100.77'), false);
  assert.equal(evalCalls[1].keys[0].includes('198.51.100.77'), false);
  assert.deepEqual(evalCalls[0].args, ['60000']);
  assert.deepEqual(evalCalls[1].args, ['60000']);
});

test('Research distributed rate-limit POC fails closed without injected backend dependency', () => {
  assert.throws(
    () => createResearchDistributedRateLimitPoc({
      keySecret: Buffer.alloc(32, 4),
      keyGenerator,
      rateLimitFactory: (options) => options
    }),
    /evalScript dependency is required/
  );
});

test('Research distributed rate-limit POC fails closed without strong HMAC secret', () => {
  assert.throws(
    () => createResearchDistributedRateLimitPoc({
      evalScript: async () => [1, 60_000],
      keySecret: Buffer.alloc(16),
      keyGenerator,
      rateLimitFactory: (options) => options
    }),
    /at least 32 bytes/
  );
});

test('Research distributed rate-limit POC fails closed without explicit client-key resolution', () => {
  assert.throws(
    () => createResearchDistributedRateLimitPoc({
      evalScript: async () => [1, 60_000],
      keySecret: Buffer.alloc(32, 4),
      rateLimitFactory: (options) => options
    }),
    /key generator is required/
  );
});
