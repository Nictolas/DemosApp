const test = require('node:test');
const assert = require('node:assert/strict');

const { issueCredentialOnce } = require('../services/identityCredentialIssuanceStore');
const { consumeCredentialOnce } = require('../services/researchCredentialRedemptionStore');

const createTransactionalUniqueClient = (keyFromParams, rowFactory) => {
  const seen = new Set();
  let locked = Promise.resolve();

  return {
    async query(sql, params) {
      const command = sql.trim().toUpperCase();
      if (command === 'BEGIN' || command === 'COMMIT' || command === 'ROLLBACK') {
        return { rows: [] };
      }

      assert.match(sql, /ON CONFLICT/i);
      assert.match(sql, /DO NOTHING/i);
      assert.match(sql, /RETURNING/i);

      // Serialize only the fake uniqueness decision, mirroring the database
      // unique constraint while allowing callers to overlap transactionally.
      let release;
      const previous = locked;
      locked = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        const key = keyFromParams(params);
        if (seen.has(key)) return { rows: [] };
        seen.add(key);
        return { rows: [rowFactory(params)] };
      } finally {
        release();
      }
    }
  };
};

test('concurrent Identity issuance has exactly one winner per account/purpose/epoch', async () => {
  const client = createTransactionalUniqueClient(
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
  const client = createTransactionalUniqueClient(
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
  let insert = null;
  const client = {
    async query(sql, params) {
      if (/INSERT\s+INTO\s+identity\.credential_issuances/i.test(sql)) {
        insert = { sql: sql.toLowerCase(), params };
        return { rows: [{ issuance_id: 'issuance-1', issued_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    }
  };

  await issueCredentialOnce(client, {
    accountId: '00000000-0000-0000-0000-000000000001',
    purpose: 'enroll',
    epoch: '2026-Q4'
  });

  assert.ok(insert);
  assert.equal(insert.sql.includes('participant_id'), false);
  assert.equal(insert.sql.includes('credential_digest'), false);
  assert.equal(insert.params.length, 3);
});

test('Research redemption SQL receives no account or participant identifier', async () => {
  let insert = null;
  const client = {
    async query(sql, params) {
      if (/INSERT\s+INTO\s+research\.spent_credentials/i.test(sql)) {
        insert = { sql: sql.toLowerCase(), params };
        return { rows: [{ redeemed_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    }
  };

  const consumed = await consumeCredentialOnce(client, {
    credentialDigest: Buffer.from('credential-digest-test'),
    purpose: 'enroll',
    epoch: '2026-Q4'
  });

  assert.equal(consumed, true);
  assert.ok(insert);
  assert.equal(insert.sql.includes('account_id'), false);
  assert.equal(insert.sql.includes('user_id'), false);
  assert.equal(insert.sql.includes('participant_id'), false);
  assert.equal(insert.params.length, 3);
});
