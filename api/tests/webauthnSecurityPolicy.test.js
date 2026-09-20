const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WEBAUTHN_USER_VERIFICATION,
  WEBAUTHN_REQUIRE_USER_VERIFICATION,
  WEBAUTHN_RESIDENT_KEY
} = require('../services/webauthnSecurityPolicy');

test('WebAuthn richiede verifica utente nelle options', () => {
  assert.equal(WEBAUTHN_USER_VERIFICATION, 'required');
});

test('WebAuthn richiede verifica utente lato server', () => {
  assert.equal(WEBAUTHN_REQUIRE_USER_VERIFICATION, true);
});


test('WebAuthn richiede una credential discoverable per il login discovery-only', () => {
  assert.equal(WEBAUTHN_RESIDENT_KEY, 'required');
});
