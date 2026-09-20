const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeWebAuthnSignCounter,
  advanceWebAuthnSignCounter
} = require('../services/webauthnSignCounterService');

test('normalizza contatori WebAuthn validi', () => {
  assert.equal(normalizeWebAuthnSignCounter(0), 0);
  assert.equal(normalizeWebAuthnSignCounter('7'), 7);
});

test('rifiuta contatori WebAuthn invalidi', () => {
  for (const value of [-1, 1.5, NaN, Infinity, 'abc', 2147483648]) {
    assert.throws(
      () => normalizeWebAuthnSignCounter(value),
      (error) => error?.code === 'INVALID_WEBAUTHN_SIGN_COUNTER'
    );
  }
});

test('contatore positivo avanza solo se maggiore di quello già salvato', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ webauthn_sign_count: 7 }] };
    }
  };

  assert.equal(await advanceWebAuthnSignCounter(db, 'user-1', 7), true);
  assert.match(calls[0].sql, /COALESCE\(webauthn_sign_count, 0\) < \$1/);
  assert.deepEqual(calls[0].params, [7, 'user-1']);
});

test('contatore zero resta supportato solo se il valore salvato è zero', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ webauthn_sign_count: 0 }] };
    }
  };

  assert.equal(await advanceWebAuthnSignCounter(db, 'user-1', 0), true);
  assert.match(calls[0].sql, /COALESCE\(webauthn_sign_count, 0\) = 0/);
  assert.deepEqual(calls[0].params, ['user-1']);
});

test('ritorna false se un login concorrente ha già avanzato il contatore', async () => {
  const db = {
    query: async () => ({ rows: [] })
  };

  assert.equal(await advanceWebAuthnSignCounter(db, 'user-1', 5), false);
});
