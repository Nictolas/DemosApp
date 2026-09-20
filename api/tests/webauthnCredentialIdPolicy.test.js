const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWebAuthnCredentialId,
  webAuthnCredentialIdLookupVariants
} = require('../services/webauthnCredentialIdPolicy');

test('normalizza credential ID base64url senza padding', () => {
  assert.equal(normalizeWebAuthnCredentialId('YWJjZA=='), 'YWJjZA');
  assert.equal(normalizeWebAuthnCredentialId('YWJjZA'), 'YWJjZA');
});

test('genera varianti compatibili senza scansione completa DB', () => {
  const variants = webAuthnCredentialIdLookupVariants('YWJjZA');
  assert.ok(variants.includes('YWJjZA'));
  assert.ok(variants.includes('YWJjZA=='));
});

test('rifiuta credential ID malformati o eccessivi', () => {
  for (const value of ['', '***', '<script>', 'a'.repeat(2049), null, 123]) {
    assert.throws(
      () => normalizeWebAuthnCredentialId(value),
      (error) => error?.code === 'INVALID_WEBAUTHN_CREDENTIAL_ID'
    );
  }
});
