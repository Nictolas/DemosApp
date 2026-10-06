const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const {
  setRegistrationChallenge,
  consumeRegistrationChallenge,
  setLoginChallenge,
  consumeLoginChallenge,
} = require('../services/webauthnChallengeStore');

const registrationKey = '550e8400-e29b-41d4-a716-446655440000';
const loginKey = ['123e4567', 'e89b', '42d3', 'a456', '426614174000'].join('-');
const challenge = 'abcdefghijklmnopQRSTUVWX_1234567890';

function registrationPayload(deviceId = 'browser_instance_123') {
  return {
    challenge,
    userHandle: Buffer.from(registrationKey, 'utf8').toString('base64url'),
    ruolo: 'E',
    deviceId,
  };
}

test('registrazione WebAuthn: challenge consumabile una sola volta', async () => {
  await setRegistrationChallenge(registrationKey, registrationPayload());

  const first = await consumeRegistrationChallenge(registrationKey);
  const replay = await consumeRegistrationChallenge(registrationKey);

  assert.deepEqual(first, registrationPayload());
  assert.equal(replay, null);
});

test('login WebAuthn: challenge consumabile una sola volta', async () => {
  await setLoginChallenge(loginKey, { challenge });

  const first = await consumeLoginChallenge(loginKey);
  const replay = await consumeLoginChallenge(loginKey);

  assert.deepEqual(first, { challenge });
  assert.equal(replay, null);
});

test('registrazione e login restano isolati anche usando la stessa UUID', async () => {
  await setRegistrationChallenge(registrationKey, registrationPayload(null));
  await setLoginChallenge(registrationKey, { challenge });

  const registration = await consumeRegistrationChallenge(registrationKey);
  const login = await consumeLoginChallenge(registrationKey);

  assert.equal(registration.ruolo, 'E');
  assert.equal(login.challenge, challenge);
});

test('rifiuta chiavi di sessione arbitrarie prima dello store', async () => {
  await assert.rejects(
    () => setRegistrationChallenge('not-a-uuid', registrationPayload()),
    (error) => error?.code === 'INVALID_WEBAUTHN_REGISTRATION_SESSION'
  );

  await assert.rejects(
    () => setLoginChallenge('not-a-uuid', { challenge }),
    (error) => error?.code === 'INVALID_WEBAUTHN_LOGIN_SESSION'
  );
});

test('rifiuta payload alterati prima del salvataggio', async () => {
  await assert.rejects(
    () => setRegistrationChallenge(registrationKey, {
      ...registrationPayload(),
      ruolo: 'AD',
    }),
    (error) => error?.code === 'INVALID_WEBAUTHN_CHALLENGE_PAYLOAD'
  );

  await assert.rejects(
    () => setLoginChallenge(loginKey, {
      challenge,
      userId: registrationKey,
    }),
    (error) => error?.code === 'INVALID_WEBAUTHN_CHALLENGE_PAYLOAD'
  );
});
