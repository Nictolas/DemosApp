const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWebAuthnChallengePayload
} = require('../services/webauthnChallengePayloadPolicy');

const challenge = 'abcdefghijklmnopQRSTUVWX_1234567890';

test('normalizza un payload registrazione valido', () => {
  const result = normalizeWebAuthnChallengePayload('register', {
    challenge,
    userHandle: 'dXNlci0x',
    ruolo: 'E',
    deviceId: null,
  });

  assert.deepEqual(result, {
    challenge,
    userHandle: 'dXNlci0x',
    ruolo: 'E',
    deviceId: null,
  });
});

test('normalizza un payload login valido', () => {
  assert.deepEqual(
    normalizeWebAuthnChallengePayload('login', { challenge }),
    { challenge }
  );
});

test('rifiuta payload registrazione incompleti o con ruolo alterato', () => {
  for (const value of [
    { challenge, userHandle: 'dXNlci0x', ruolo: 'AD', deviceId: null },
    { challenge, ruolo: 'E', deviceId: null },
    { challenge, userHandle: 'dXNlci0x', ruolo: 'E' },
  ]) {
    assert.throws(
      () => normalizeWebAuthnChallengePayload('register', value),
      (error) =>
        error?.code === 'INVALID_WEBAUTHN_CHALLENGE_PAYLOAD' ||
        error?.code === 'INVALID_WEBAUTHN_CLIENT_INSTANCE_ID' ||
        error?.code === 'INVALID_WEBAUTHN_USER_HANDLE'
    );
  }
});

test('rifiuta campi inattesi e challenge malformate', () => {
  assert.throws(
    () => normalizeWebAuthnChallengePayload('login', {
      challenge,
      userId: 'user-1',
    }),
    (error) => error?.code === 'INVALID_WEBAUTHN_CHALLENGE_PAYLOAD'
  );

  assert.throws(
    () => normalizeWebAuthnChallengePayload('login', { challenge: 'short' }),
    (error) => error?.code === 'INVALID_WEBAUTHN_CHALLENGE_PAYLOAD'
  );
});

test('rifiuta payload non-oggetto', () => {
  for (const value of [null, [], 'value']) {
    assert.throws(
      () => normalizeWebAuthnChallengePayload('login', value),
      (error) => error?.code === 'INVALID_WEBAUTHN_CHALLENGE_PAYLOAD'
    );
  }
});
