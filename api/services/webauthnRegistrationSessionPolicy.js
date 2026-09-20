const { randomUUID } = require('crypto');

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidRegistrationSessionError() {
  const error = new Error('Sessione registrazione WebAuthn non valida');
  error.code = 'INVALID_WEBAUTHN_REGISTRATION_SESSION';
  return error;
}

function createWebAuthnRegistrationSessionKey() {
  return randomUUID();
}

function normalizeWebAuthnRegistrationSessionKey(value) {
  if (typeof value !== 'string') {
    throw invalidRegistrationSessionError();
  }

  const normalized = value.trim();
  if (!UUID_V4_PATTERN.test(normalized)) {
    throw invalidRegistrationSessionError();
  }

  return normalized;
}

module.exports = {
  createWebAuthnRegistrationSessionKey,
  normalizeWebAuthnRegistrationSessionKey,
};
