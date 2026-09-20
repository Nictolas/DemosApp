const MAX_CREDENTIAL_ID_LENGTH = 2048;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

function invalidCredentialIdError() {
  const error = new Error('Credential ID WebAuthn non valido');
  error.code = 'INVALID_WEBAUTHN_CREDENTIAL_ID';
  return error;
}

function normalizeWebAuthnCredentialId(value) {
  if (typeof value !== 'string') {
    throw invalidCredentialIdError();
  }

  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_CREDENTIAL_ID_LENGTH ||
    !BASE64URL_PATTERN.test(trimmed)
  ) {
    throw invalidCredentialIdError();
  }

  try {
    const bytes = Buffer.from(trimmed.replace(/=+$/, ''), 'base64url');
    if (!bytes.length) throw invalidCredentialIdError();

    const canonical = bytes.toString('base64url');
    if (!canonical) throw invalidCredentialIdError();

    return canonical;
  } catch (error) {
    if (error?.code === 'INVALID_WEBAUTHN_CREDENTIAL_ID') throw error;
    throw invalidCredentialIdError();
  }
}

function webAuthnCredentialIdLookupVariants(value) {
  const canonical = normalizeWebAuthnCredentialId(value);
  const bytes = Buffer.from(canonical, 'base64url');

  const base64urlPadded = bytes.toString('base64url') +
    '='.repeat((4 - (bytes.toString('base64url').length % 4)) % 4);
  const base64 = bytes.toString('base64');
  const base64NoPadding = base64.replace(/=+$/, '');

  return [...new Set([
    canonical,
    base64urlPadded,
    base64,
    base64NoPadding,
  ])];
}

module.exports = {
  normalizeWebAuthnCredentialId,
  webAuthnCredentialIdLookupVariants
};
