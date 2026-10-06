const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_RATE_LIMIT_KEY_PREFIX,
  ATOMIC_INCREMENT_SCRIPT,
  createResearchAtomicRateLimitBackend
} = require('../services/researchAtomicRateLimitBackend');

test('Research atomic backend performs increment and expiry in one injected script call', async () => {
  const calls = [];
  const backend = createResearchAtomicRateLimitBackend({
    now: () => 1_000,
    evalScript: async (input) => {
      calls.push(input);
      return [3, 45_000];
    }
  });

  const key = 'A'.repeat(43);
  const result = await backend.increment({ key, windowMs: 60_000 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].script, ATOMIC_INCREMENT_SCRIPT);
  assert.deepEqual(calls[0].keys, [RESEARCH_RATE_LIMIT_KEY_PREFIX + key]);
  assert.deepEqual(calls[0].args, ['60000']);
  assert.equal(result.totalHits, 3);
  assert.equal(result.resetTime.toISOString(), new Date(46_000).toISOString());
});

test('Research atomic backend script applies expiry only on first increment and returns TTL', () => {
  assert.match(ATOMIC_INCREMENT_SCRIPT, /INCR/);
  assert.match(ATOMIC_INCREMENT_SCRIPT, /count == 1/);
  assert.match(ATOMIC_INCREMENT_SCRIPT, /PEXPIRE/);
  assert.match(ATOMIC_INCREMENT_SCRIPT, /PTTL/);
});

test('Research atomic backend accepts only opaque HMAC-shaped keys', async () => {
  const backend = createResearchAtomicRateLimitBackend({
    evalScript: async () => [1, 60_000]
  });

  await assert.rejects(
    () => backend.increment({ key: '203.0.113.42', windowMs: 60_000 }),
    /key is invalid/
  );
  await assert.rejects(
    () => backend.increment({ key: 'Bearer-secret-token', windowMs: 60_000 }),
    /key is invalid/
  );
});

test('Research atomic backend fails closed on malformed atomic results', async () => {
  const key = 'B'.repeat(43);
  for (const result of [null, [0, 1000], [1, 0], ['NaN', 1000]]) {
    const backend = createResearchAtomicRateLimitBackend({
      evalScript: async () => result
    });
    await assert.rejects(
      () => backend.increment({ key, windowMs: 60_000 }),
      /invalid/
    );
  }
});
