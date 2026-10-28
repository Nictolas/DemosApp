const test = require('node:test');
const assert = require('node:assert/strict');

process.env.IDENTITY_HMAC_SECRET = 'test-secret-for-demos-identity-key-1234567890';

const {
  getFiscalNumberFromVerifiedClaims,
  assertAccountCanStartCieVerification,
  completeCieVerificationFromVerifiedClaims
} = require('../services/cieVerificationService');

test('estrae fiscal_number solo dai claims gia verificati', () => {
  assert.equal(
    getFiscalNumberFromVerifiedClaims({ fiscal_number: 'TINIT-ABCDEF12G34H567I' }),
    'TINIT-ABCDEF12G34H567I'
  );
});

test('rifiuta claims senza fiscal_number', () => {
  assert.throws(
    () => getFiscalNumberFromVerifiedClaims({ sub: 'cie-sub' }),
    /fiscal_number mancante/
  );
});

test('completa CIE usando il persistence layer senza esporre person_key', async () => {
  let call = 0;
  const db = {
    async query(sql, params) {
      call++;
      if (call === 1) return { rows: [] };

      assert.match(sql, /INSERT INTO identity_verifications/);
      assert.equal(params[0], 'user-1');
      assert.match(params[1], /^[a-f0-9]{64}$/);
      assert.equal(params[2], 'CIE');

      return {
        rows: [{
          provider: 'CIE',
          status: 'verified',
          verified_at: '2026-09-20T00:00:00Z',
          detached_at: null,
          retention_until: null
        }]
      };
    }
  };

  const result = await completeCieVerificationFromVerifiedClaims({
    userId: 'user-1',
    claims: { fiscal_number: 'TINIT-ABCDEF12G34H567I' }
  }, db);

  assert.equal(result.verified, true);
  assert.equal(result.provider, 'CIE');
  assert.equal(Object.hasOwn(result, 'person_key'), false);
});


test('consente avvio CIE se account non verificato', async () => {
  const db = {
    async query(sql, params) {
      assert.match(sql, /SELECT provider, status/);
      assert.equal(params[0], 'user-1');
      return { rows: [] };
    }
  };

  assert.equal(
    await assertAccountCanStartCieVerification('user-1', db),
    true
  );
});

test('blocca avvio CIE se account e gia verificato', async () => {
  const db = {
    async query() {
      return {
        rows: [{
          provider: 'CIE',
          status: 'verified'
        }]
      };
    }
  };

  await assert.rejects(
    assertAccountCanStartCieVerification('user-1', db),
    error => error?.code === 'ACCOUNT_ALREADY_VERIFIED'
  );
});

test('salvataggio sesso CIE avviene nella stessa transazione del legame identita', async () => {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT person_key')) return { rows: [] };
      if (sql.includes('INSERT INTO identity_verifications')) {
        return { rows: [{ provider: 'CIE', status: 'verified' }] };
      }
      if (sql.includes('UPDATE users SET sesso')) return { rowCount: 1 };
      return { rows: [] };
    },
    release() { released = true; }
  };
  const pool = { async connect() { return client; } };
  const result = await completeCieVerificationFromVerifiedClaims({
    userId: 'user-1',
    claims: { fiscal_number: 'TINIT-ABCDEF12G34H567I', sesso: 'F' }
  }, pool);
  assert.equal(result.verified, true);
  assert.deepEqual(calls.map(x => x.sql.trim().split(/\\s+/)[0]), [
    'BEGIN', 'SELECT', 'INSERT', 'UPDATE', 'COMMIT'
  ]);
  assert.deepEqual(calls[3].params, ['F', 'user-1']);
  assert.equal(released, true);
});

test('errore sul sesso CIE fa rollback anche della verifica identita', async () => {
  const queries = [];
  let released = false;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('SELECT person_key')) return { rows: [] };
      if (sql.includes('INSERT INTO identity_verifications')) {
        return { rows: [{ provider: 'CIE', status: 'verified' }] };
      }
      if (sql.includes('UPDATE users SET sesso')) return { rowCount: 0 };
      return { rows: [] };
    },
    release() { released = true; }
  };
  await assert.rejects(
    completeCieVerificationFromVerifiedClaims({
      userId: 'user-1',
      claims: { fiscal_number: 'TINIT-ABCDEF12G34H567I', sesso: 'M' }
    }, { connect: async () => client }),
    /Conflitto/
  );
  assert.equal(queries[queries.length - 1], 'ROLLBACK');
  assert.equal(queries.includes('COMMIT'), false);
  assert.equal(released, true);
});
