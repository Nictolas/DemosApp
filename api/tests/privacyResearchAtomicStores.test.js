const test = require('node:test');
const assert = require('node:assert/strict');

const {
  issueCredentialOnce
} = require('../services/identityCredentialIssuanceStore');
const {
  consumeCredentialOnce
} = require('../services/researchCredentialRedemptionStore');

const createAtomicUniqueClient = (keyFromParams, rowFactory) => {
  const seen = new Set();

  return {
    async query(sql, params) {
      assert.match(sql, /ON CONFLICT/i);
      assert.match(sql, /DO NOTHING/i);
      assert.match(sql, /RETURNING/i);

      // Yield so concurrent callers overlap before the atomic uniqueness decision.
      await new Promise((resolve) => setImmediate(resolve));

      const key = keyFromParams(params);
      if (seen.has(key)) return { rows: [] };

      seen.add(key);
      return { rows: [rowFactory(params)] };
    }
  };
};

test('concurrent Identity issuance has exactly one winner per account/purpose/epoch', async () => {
  const client = createAtomicUniqueClient(
    ([accountId, purpose, epoch]) => [accountId, purpose, epoch].join('|'),
    () => ({ issuance_id: 'issuance-1', issued_at: new Date().toISOString() })
  );

  const attempts = await Promise.all(
    Array.from({ length: 12 }, () =>
      issueCredentialOnce(client, {
        accountId: '00000000-0000-0000-0000-000000000001',
        purpose: 'enroll',
        epoch: '2026-Q4'
      })
    )
  );

  assert.equal(attempts.filter(Boolean).length, 1);
});

test('concurrent Research redemption consumes the same digest exactly once', async () => {
  const client = createAtomicUniqueClient(
    ([credentialDigest]) => Buffer.from(credentialDigest).toString('hex'),
    () => ({ redeemed_at: new Date().toISOString() })
  );
  const digest = Buffer.from('credential-digest-test');

  const attempts = await Promise.all(
    Array.from({ length: 12 }, () =>
      consumeCredentialOnce(client, {
        credentialDigest: digest,
        purpose: 'enroll',
        epoch: '2026-Q4'
      })
    )
  );

  assert.equal(attempts.filter(Boolean).length, 1);
});

test('Identity issuance SQL does not accept Research participant or credential digest fields', async () => {
  let captured = null;
  const client = {
    async query(sql, params) {
      captured = { sql: sql.toLowerCase(), params };
      return { rows: [{ issuance_id: 'issuance-1', issued_at: new Date().toISOString() }] };
    }
  };

  await issueCredentialOnce(client, {
    accountId: '00000000-0000-0000-0000-000000000001',
    purpose: 'enroll',
    epoch: '2026-Q4'
  });

  assert.equal(captured.sql.includes('participant_id'), false);
  assert.equal(captured.sql.includes('credential_digest'), false);
  assert.equal(captured.params.length, 3);
});

test('Research redemption SQL receives no account or participant identifier', async () => {
  let captured = null;
  const client = {
    async query(sql, params) {
      captured = { sql: sql.toLowerCase(), params };
      return { rows: [{ redeemed_at: new Date().toISOString() }] };
    }
  };

  const consumed = await consumeCredentialOnce(client, {
    credentialDigest: Buffer.from('credential-digest-test'),
    purpose: 'enroll',
    epoch: '2026-Q4'
  });

  assert.equal(consumed, true);
  assert.equal(captured.sql.includes('account_id'), false);
  assert.equal(captured.sql.includes('user_id'), false);
  assert.equal(captured.sql.includes('participant_id'), false);
  assert.equal(captured.params.length, 3);
});
