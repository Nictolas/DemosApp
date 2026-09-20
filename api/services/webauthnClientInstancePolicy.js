const CLIENT_INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;

function invalidClientInstanceIdError() {
  const error = new Error('Identificatore installazione WebAuthn non valido');
  error.code = 'INVALID_WEBAUTHN_CLIENT_INSTANCE_ID';
  return error;
}

function normalizeWebAuthnClientInstanceId(value, { required = false } = {}) {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    if (required) throw invalidClientInstanceIdError();
    return null;
  }

  if (typeof value !== 'string') {
    throw invalidClientInstanceIdError();
  }

  const normalized = value.trim();
  if (!CLIENT_INSTANCE_ID_PATTERN.test(normalized)) {
    throw invalidClientInstanceIdError();
  }

  return normalized;
}

module.exports = {
  normalizeWebAuthnClientInstanceId
};
