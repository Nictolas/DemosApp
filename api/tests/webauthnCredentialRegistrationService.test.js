const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ensureWebAuthnCredentialAvailable
} = require('../services/webauthnCredentialRegistrationService');

test('blocca transazionalmente il credential ID prima del controllo duplicati', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/pg_advisory_xact_lock/.test(sql)) return { rows: [{}] };
      return { rows: [] };
    }
  };

  const available = await ensureWebAuthnCredentialAvailable(db, 'YWJjZA');

  assert.equal(available, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /pg_advisory_xact_lock/);
  assert.match(calls[1].sql, /webauthn_credential_id = ANY/);
});

test('rileva credential ID già associato a un account', async () => {
  const db = {
    query: async (sql) => {
      if (/pg_advisory_xact_lock/.test(sql)) return { rows: [{}] };
      return { rows: [{ id: 'existing-user' }] };
    }
  };

  const available = await ensureWebAuthnCredentialAvailable(db, 'YWJjZA');

  assert.equal(available, false);
});

test('usa varianti compatibili del credential ID nel controllo duplicati', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    }
  };

  await ensureWebAuthnCredentialAvailable(db, 'YWJjZA');

  const variants = calls[1].params[0];
  assert.ok(variants.includes('YWJjZA'));
  assert.ok(variants.includes('YWJjZA=='));
});
