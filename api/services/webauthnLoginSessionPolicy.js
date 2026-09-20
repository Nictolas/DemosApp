const { randomUUID } = require('crypto');

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidLoginSessionError() {
  const error = new Error('Sessione login WebAuthn non valida');
  error.code = 'INVALID_WEBAUTHN_LOGIN_SESSION';
  return error;
}

function createWebAuthnLoginSessionKey() {
  return randomUUID();
}

function normalizeWebAuthnLoginSessionKey(value) {
  if (typeof value !== 'string') {
    throw invalidLoginSessionError();
  }

  const normalized = value.trim();
  if (!UUID_V4_PATTERN.test(normalized)) {
    throw invalidLoginSessionError();
  }

  return normalized;
}

module.exports = {
  createWebAuthnLoginSessionKey,
  normalizeWebAuthnLoginSessionKey
};
