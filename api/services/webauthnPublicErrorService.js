const PUBLIC_WEBAUTHN_ERRORS = Object.freeze({
  REGISTRATION_VERIFICATION_FAILED: Object.freeze({
    code: 'PASSKEY_REGISTRATION_VERIFICATION_FAILED',
    error: 'Verifica passkey non riuscita',
    message: 'La verifica della passkey non è riuscita. Riprova.'
  }),
  REGISTRATION_FAILED: Object.freeze({
    code: 'PASSKEY_REGISTRATION_FAILED',
    error: 'Registrazione passkey non riuscita',
    message: 'Non è stato possibile completare la registrazione con passkey. Riprova.'
  }),
  AUTHENTICATION_VERIFICATION_FAILED: Object.freeze({
    code: 'PASSKEY_AUTHENTICATION_VERIFICATION_FAILED',
    error: 'Verifica login passkey non riuscita',
    message: 'La verifica del login con passkey non è riuscita. Riprova.'
  })
});

function getPublicWebAuthnError(key) {
  const value = PUBLIC_WEBAUTHN_ERRORS[key];
  if (!value) {
    return {
      code: 'PASSKEY_ERROR',
      error: 'Operazione passkey non riuscita',
      message: 'Si è verificato un errore con la passkey. Riprova.'
    };
  }
  return { ...value };
}

module.exports = {
  PUBLIC_WEBAUTHN_ERRORS,
  getPublicWebAuthnError
};
