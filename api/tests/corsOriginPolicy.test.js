const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAllowedCorsOrigins,
  evaluateCorsOrigin
} = require('../config/corsOriginPolicy');

test('production CORS allows only explicit production origins', () => {
  const allowed = getAllowedCorsOrigins('production');
  assert.equal(allowed.has('https://www.demos.community'), true);
  assert.equal(allowed.has('https://demos.community'), true);
  assert.equal(allowed.has('https://demos-c7k0.onrender.com'), true);
  assert.equal(allowed.has('https://evil.onrender.com'), false);
  assert.equal(allowed.has('http://localhost:5173'), false);
});

test('development CORS additionally allows explicit localhost origins', () => {
  const allowed = getAllowedCorsOrigins('development');
  assert.equal(allowed.has('http://localhost:3000'), true);
  assert.equal(allowed.has('http://localhost:5173'), true);
  assert.equal(allowed.has('http://127.0.0.1:3000'), true);
  assert.equal(allowed.has('http://127.0.0.1:5173'), true);
});

test('unknown browser origins are rejected', () => {
  assert.deepEqual(
    evaluateCorsOrigin('https://attacker.example', { nodeEnv: 'production' }),
    { allowed: false, reason: 'origin-not-allowlisted' }
  );
});

test('requests without Origin preserve current mobile/server-to-server compatibility', () => {
  assert.deepEqual(
    evaluateCorsOrigin(undefined, { nodeEnv: 'production' }),
    { allowed: true, reason: 'non-browser-client' }
  );
});

test('no-origin behavior can be switched fail-closed explicitly', () => {
  assert.deepEqual(
    evaluateCorsOrigin(undefined, {
      nodeEnv: 'production',
      allowRequestsWithoutOrigin: false
    }),
    { allowed: false, reason: 'origin-required' }
  );
});
