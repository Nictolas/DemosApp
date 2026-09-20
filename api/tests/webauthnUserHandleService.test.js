const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWebAuthnUserHandle,
  expectedWebAuthnUserHandle,
  webAuthnUserHandleMatches
} = require('../services/webauthnUserHandleService');

test('normalizza userHandle base64url', () => {
  assert.equal(normalizeWebAuthnUserHandle('YWJjZA=='), 'YWJjZA');
});

test('usa il valore salvato quando presente', () => {
  assert.equal(
    expectedWebAuthnUserHandle('user-1', 'YWJjZA'),
    'YWJjZA'
  );
});

test('deriva userHandle da userId per account legacy senza valore salvato', () => {
  assert.equal(
    expectedWebAuthnUserHandle('user-1', null),
    Buffer.from('user-1', 'utf8').toString('base64url')
  );
});

test('accetta userHandle assente per compatibilità', () => {
  assert.equal(webAuthnUserHandleMatches('user-1', null, null), true);
});

test('confronta userHandle ricevuto con quello atteso', () => {
  const expected = Buffer.from('user-1', 'utf8').toString('base64url');

  assert.equal(webAuthnUserHandleMatches('user-1', null, expected), true);
  assert.equal(
    webAuthnUserHandleMatches(
      'user-1',
      null,
      Buffer.from('user-2', 'utf8').toString('base64url')
    ),
    false
  );
});

test('rifiuta userHandle malformati o oltre 64 byte', () => {
  const tooLong = Buffer.alloc(65, 1).toString('base64url');

  for (const value of ['', '***', tooLong, 123]) {
    assert.throws(
      () => normalizeWebAuthnUserHandle(value),
      (error) => error?.code === 'INVALID_WEBAUTHN_USER_HANDLE'
    );
  }
});
