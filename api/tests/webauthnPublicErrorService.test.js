const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getPublicWebAuthnError
} = require('../services/webauthnPublicErrorService');

test('gli errori pubblici WebAuthn sono stabili e non includono dettagli interni', () => {
  const internalDetail = 'Unexpected RP ID mismatch at verifyRegistrationResponse';
  const publicError = getPublicWebAuthnError('REGISTRATION_VERIFICATION_FAILED');

  assert.equal(publicError.code, 'PASSKEY_REGISTRATION_VERIFICATION_FAILED');
  assert.equal(publicError.message, 'La verifica della passkey non è riuscita. Riprova.');
  assert.equal(JSON.stringify(publicError).includes(internalDetail), false);
});

test('errore WebAuthn sconosciuto usa un fallback pubblico generico', () => {
  assert.deepEqual(getPublicWebAuthnError('NOT_REAL'), {
    code: 'PASSKEY_ERROR',
    error: 'Operazione passkey non riuscita',
    message: 'Si è verificato un errore con la passkey. Riprova.'
  });
});
