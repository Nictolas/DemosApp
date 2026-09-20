const crypto = require('crypto');

const STATE_BYTES = 32;
const NONCE_BYTES = 32;
const VERIFIER_BYTES = 64;

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function randomValue(bytes) {
  return base64url(crypto.randomBytes(bytes));
}

function createPkcePair() {
  const codeVerifier = randomValue(VERIFIER_BYTES);
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier, 'ascii').digest()
  );

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

function createCieOidcTransaction() {
  const pkce = createPkcePair();

  return {
    state: randomValue(STATE_BYTES),
    nonce: randomValue(NONCE_BYTES),
    ...pkce
  };
}

function timingSafeEqualString(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;

  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function verifyState(expectedState, receivedState) {
  return timingSafeEqualString(expectedState, receivedState);
}

function verifyNonce(expectedNonce, receivedNonce) {
  return timingSafeEqualString(expectedNonce, receivedNonce);
}

module.exports = {
  createPkcePair,
  createCieOidcTransaction,
  verifyState,
  verifyNonce
};
