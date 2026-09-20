const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createWebAuthnLoginSessionKey,
  normalizeWebAuthnLoginSessionKey
} = require('../services/webauthnLoginSessionPolicy');

test('genera sessionKey WebAuthn UUID v4 indipendenti', () => {
  const first = createWebAuthnLoginSessionKey();
  const second = createWebAuthnLoginSessionKey();

  assert.notEqual(first, second);
  assert.equal(normalizeWebAuthnLoginSessionKey(first), first);
  assert.equal(normalizeWebAuthnLoginSessionKey(second), second);
});

test('rifiuta sessionKey arbitrarie o malformate', () => {
  for (const value of [
    undefined,
    null,
    '',
    'user-id',
    '550e8400-e29b-11d4-a716-446655440000',
    'x'.repeat(200)
  ]) {
    assert.throws(
      () => normalizeWebAuthnLoginSessionKey(value),
      (error) => error?.code === 'INVALID_WEBAUTHN_LOGIN_SESSION'
    );
  }
});
