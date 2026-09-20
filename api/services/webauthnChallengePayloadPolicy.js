const {
  PUBLIC_WEBAUTHN_REGISTRATION_ROLE,
} = require('./webauthnRegistrationPolicy');
const {
  normalizeWebAuthnClientInstanceId,
} = require('./webauthnClientInstancePolicy');
const {
  normalizeWebAuthnUserHandle,
} = require('./webauthnUserHandleService');

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{16,1024}$/;

function invalidChallengePayloadError() {
  const error = new Error('Payload challenge WebAuthn non valido');
  error.code = 'INVALID_WEBAUTHN_CHALLENGE_PAYLOAD';
  return error;
}

function normalizeChallenge(value) {
  if (
    typeof value !== 'string' ||
    !CHALLENGE_PATTERN.test(value.trim())
  ) {
    throw invalidChallengePayloadError();
  }
  return value.trim();
}

function assertPlainObject(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw invalidChallengePayloadError();
  }
}

function assertExactKeys(value, expectedKeys) {
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw invalidChallengePayloadError();
  }
}

function normalizeRegistrationChallengePayload(value) {
  assertPlainObject(value);
  assertExactKeys(value, ['challenge', 'userHandle', 'ruolo', 'deviceId']);

  if (value.ruolo !== PUBLIC_WEBAUTHN_REGISTRATION_ROLE) {
    throw invalidChallengePayloadError();
  }

  return {
    challenge: normalizeChallenge(value.challenge),
    userHandle: normalizeWebAuthnUserHandle(value.userHandle),
    ruolo: PUBLIC_WEBAUTHN_REGISTRATION_ROLE,
    deviceId: normalizeWebAuthnClientInstanceId(value.deviceId),
  };
}

function normalizeLoginChallengePayload(value) {
  assertPlainObject(value);
  assertExactKeys(value, ['challenge']);

  return {
    challenge: normalizeChallenge(value.challenge),
  };
}

function normalizeWebAuthnChallengePayload(kind, value) {
  if (kind === 'register') {
    return normalizeRegistrationChallengePayload(value);
  }
  if (kind === 'login') {
    return normalizeLoginChallengePayload(value);
  }
  throw invalidChallengePayloadError();
}

module.exports = {
  normalizeWebAuthnChallengePayload,
};
