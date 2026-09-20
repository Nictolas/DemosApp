const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PUBLIC_WEBAUTHN_REGISTRATION_ROLE,
  getPublicWebAuthnRegistrationRole
} = require('../services/webauthnRegistrationPolicy');

test('la registrazione pubblica WebAuthn crea sempre un Elettore', () => {
  assert.equal(PUBLIC_WEBAUTHN_REGISTRATION_ROLE, 'E');
  assert.equal(getPublicWebAuthnRegistrationRole(), 'E');
});

test('il ruolo pubblico WebAuthn non dipende da input client', () => {
  const maliciousInputs = ['AD', 'P', 'C', 'CP', 'A', 'O', 'I', null, undefined];

  for (const _input of maliciousInputs) {
    assert.equal(getPublicWebAuthnRegistrationRole(_input), 'E');
  }
});
