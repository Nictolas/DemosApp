const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  createPkcePair,
  createCieOidcTransaction,
  verifyState,
  verifyNonce
} = require('../services/cieOidcTransactionService');

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

test('genera state e nonce indipendenti', () => {
  const tx = createCieOidcTransaction();

  assert.ok(tx.state.length >= 40);
  assert.ok(tx.nonce.length >= 40);
  assert.notEqual(tx.state, tx.nonce);
});

test('genera PKCE S256 corretto', () => {
  const { codeVerifier, codeChallenge, codeChallengeMethod } = createPkcePair();

  const expected = base64url(
    crypto.createHash('sha256').update(codeVerifier, 'ascii').digest()
  );

  assert.equal(codeChallengeMethod, 'S256');
  assert.equal(codeChallenge, expected);
  assert.ok(codeVerifier.length >= 43);
});

test('state accetta solo il valore esatto', () => {
  const tx = createCieOidcTransaction();

  assert.equal(verifyState(tx.state, tx.state), true);
  assert.equal(verifyState(tx.state, tx.state + 'x'), false);
  assert.equal(verifyState(tx.state, null), false);
});

test('nonce accetta solo il valore esatto', () => {
  const tx = createCieOidcTransaction();

  assert.equal(verifyNonce(tx.nonce, tx.nonce), true);
  assert.equal(verifyNonce(tx.nonce, 'altro'), false);
});
