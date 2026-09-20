const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWebAuthnClientInstanceId
} = require('../services/webauthnClientInstancePolicy');

test('normalizza un identificatore installazione valido', () => {
  assert.equal(
    normalizeWebAuthnClientInstanceId(' 550e8400-e29b-41d4-a716-446655440000 '),
    '550e8400-e29b-41d4-a716-446655440000'
  );
});

test('rifiuta identificatori installazione arbitrari o troppo lunghi', () => {
  for (const value of ['short', 'abc def ghi', '<script>alert(1)</script>', 'a'.repeat(129), 123]) {
    assert.throws(
      () => normalizeWebAuthnClientInstanceId(value),
      (error) => error?.code === 'INVALID_WEBAUTHN_CLIENT_INSTANCE_ID'
    );
  }
});

test('può essere opzionale o obbligatorio', () => {
  assert.equal(normalizeWebAuthnClientInstanceId(undefined), null);
  assert.throws(
    () => normalizeWebAuthnClientInstanceId(undefined, { required: true }),
    (error) => error?.code === 'INVALID_WEBAUTHN_CLIENT_INSTANCE_ID'
  );
});
