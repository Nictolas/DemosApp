const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createWebAuthnRegistrationSessionKey,
  normalizeWebAuthnRegistrationSessionKey
} = require('../services/webauthnRegistrationSessionPolicy');

test('genera una session key UUID v4 per la registrazione WebAuthn', () => {
  const value = createWebAuthnRegistrationSessionKey();

  assert.match(
    value,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test('normalizza una session key UUID v4 valida', () => {
  const value = ' 550e8400-e29b-41d4-a716-446655440000 ';
  assert.equal(
    normalizeWebAuthnRegistrationSessionKey(value),
    '550e8400-e29b-41d4-a716-446655440000'
  );
});

test('rifiuta session key registrazione WebAuthn arbitrarie', () => {
  for (const value of [null, '', 'abc', '550e8400-e29b-11d4-a716-446655440000']) {
    assert.throws(
      () => normalizeWebAuthnRegistrationSessionKey(value),
      (error) => error?.code === 'INVALID_WEBAUTHN_REGISTRATION_SESSION'
    );
  }
});
