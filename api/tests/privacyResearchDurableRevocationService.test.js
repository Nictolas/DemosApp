const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { acceptRevocationRelayItemDurably } = require('../services/researchDurableRevocationService');

const capability = Buffer.alloc(32, 9);
const expectedDigest = crypto.createHash('sha256').update(capability).digest();

const makeClient = ({ missing = false, commitFails = false } = {}) => {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const normalized = sql.trim().toLowerCase();
      if (normalized === 'begin' || normalized === 'rollback') return { rows: [] };
      if (normalized === 'set local synchronous_commit = on') return { rows: [] };
      if (normalized.includes('update research.participants')) {
        return missing ? { rows: [] } : { rows: [{ status: 'revoked' }] };
      }
      if (normalized === 'commit') {
        if (commitFails) throw new Error('simulated commit failure');
        return { rows: [] };
      }
      throw new Error('unexpected query');
    }
  };
};

test('Research returns durable acknowledgement only after synchronous PostgreSQL commit', async () => {
  const client = makeClient();
  const result = await acceptRevocationRelayItemDurably(client, { capability });

  assert.deepEqual(result, { accepted: true, durable: true });
  assert.equal(client.calls[0].sql, 'BEGIN');
  assert.equal(client.calls[1].sql, 'SET LOCAL synchronous_commit = on');
  assert.match(client.calls[2].sql, /revocation_capability_digest = \$1/i);
  assert.deepEqual(client.calls[2].params, [expectedDigest]);
  assert.equal(client.calls[3].sql, 'COMMIT');
});

test('durable revocation is idempotent for an already-revoked participant', async () => {
  const client = makeClient();
  await acceptRevocationRelayItemDurably(client, { capability });
  const update = client.calls.find(({ sql }) => /update research\.participants/i.test(sql));

  assert.doesNotMatch(update.sql, /status\s*<>\s*'revoked'/i);
  assert.match(update.sql, /set status = 'revoked'/i);
});

test('unknown capability is not acknowledged and transaction is rolled back', async () => {
  const client = makeClient({ missing: true });
  const result = await acceptRevocationRelayItemDurably(client, { capability });

  assert.deepEqual(result, { accepted: false, durable: false });
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(client.calls.some(({ sql }) => sql === 'COMMIT'), false);
});

test('commit failure never produces a durable acknowledgement', async () => {
  const client = makeClient({ commitFails: true });
  await assert.rejects(
    () => acceptRevocationRelayItemDurably(client, { capability }),
    /simulated commit failure/
  );
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
});

test('durable revocation rejects correlating metadata before database access', async () => {
  const client = makeClient();
  await assert.rejects(
    () => acceptRevocationRelayItemDurably(client, { capability, accountId: 'forbidden' }),
    /Correlating relay metadata forbidden/
  );
  assert.equal(client.calls.length, 0);
});

test('durable Research revocation service has no Identity linkage surface', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchDurableRevocationService.js'),
    'utf8'
  ).toLowerCase();
  for (const forbidden of ['identity.', 'account_id', 'user_id', 'email', 'participant_id']) {
    assert.equal(source.includes(forbidden), false, 'forbidden linkage surface: ' + forbidden);
  }
});
