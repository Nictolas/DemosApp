const crypto = require('crypto');

const MAX_USER_HANDLE_BYTES = 64;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

function invalidUserHandleError() {
  const error = new Error('User handle WebAuthn non valido');
  error.code = 'INVALID_WEBAUTHN_USER_HANDLE';
  return error;
}

function normalizeWebAuthnUserHandle(value) {
  if (typeof value !== 'string') {
    throw invalidUserHandleError();
  }

  const trimmed = value.trim();
  if (!trimmed || !BASE64URL_PATTERN.test(trimmed)) {
    throw invalidUserHandleError();
  }

  try {
    const bytes = Buffer.from(trimmed.replace(/=+$/, ''), 'base64url');
    if (!bytes.length || bytes.length > MAX_USER_HANDLE_BYTES) {
      throw invalidUserHandleError();
    }
    return bytes.toString('base64url');
  } catch (error) {
    if (error?.code === 'INVALID_WEBAUTHN_USER_HANDLE') throw error;
    throw invalidUserHandleError();
  }
}

function expectedWebAuthnUserHandle(userId, storedHandle) {
  if (storedHandle) {
    return normalizeWebAuthnUserHandle(storedHandle);
  }

  if (typeof userId !== 'string' || !userId.trim()) {
    throw invalidUserHandleError();
  }

  const derived = Buffer.from(userId.trim(), 'utf8');
  if (!derived.length || derived.length > MAX_USER_HANDLE_BYTES) {
    throw invalidUserHandleError();
  }

  return derived.toString('base64url');
}

function webAuthnUserHandleMatches(userId, storedHandle, receivedHandle) {
  if (receivedHandle == null || receivedHandle === '') {
    return true;
  }

  const expected = Buffer.from(
    expectedWebAuthnUserHandle(userId, storedHandle),
    'base64url',
  );
  const received = Buffer.from(
    normalizeWebAuthnUserHandle(receivedHandle),
    'base64url',
  );

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

module.exports = {
  normalizeWebAuthnUserHandle,
  expectedWebAuthnUserHandle,
  webAuthnUserHandleMatches,
};
