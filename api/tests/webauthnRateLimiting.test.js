const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WEBAUTHN_RATE_LIMITS
} = require('../middleware/webauthnRateLimiting');

test('i limiti WebAuthn sono più restrittivi del limiter auth generale', () => {
  assert.equal(WEBAUTHN_RATE_LIMITS.STATUS_MAX, 120);
  assert.equal(WEBAUTHN_RATE_LIMITS.CHALLENGE_MAX, 60);
  assert.equal(WEBAUTHN_RATE_LIMITS.VERIFY_MAX, 30);

  assert.ok(WEBAUTHN_RATE_LIMITS.VERIFY_MAX < WEBAUTHN_RATE_LIMITS.CHALLENGE_MAX);
  assert.ok(WEBAUTHN_RATE_LIMITS.CHALLENGE_MAX < WEBAUTHN_RATE_LIMITS.STATUS_MAX);
});

test('tutti i limiti WebAuthn sono positivi e finiti', () => {
  for (const value of Object.values(WEBAUTHN_RATE_LIMITS)) {
    assert.equal(Number.isFinite(value), true);
    assert.ok(value > 0);
  }
});
