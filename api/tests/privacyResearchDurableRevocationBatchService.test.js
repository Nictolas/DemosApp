const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildRelayBatch } = require('../services/researchRevocationRelayBoundary');
const { acceptRevocationRelayBatchDurably } = require('../services/researchDurableRevocationBatchService');

const capabilities = () => Array.from({ length: 8 }, (_, index) =>
  ({ capability: crypto.createHash('sha256').update('capability-' + index).digest() })
);

const makeClient = ({ missingUpdate = -1, commitFails = false } = {}) => {
  const calls = [];
  let updateIndex = 0;
  return {
    calls,
    async query(sql) {
      calls.push(sql);
      const normalized = sql.trim().toLowerCase();
      if (normalized === 'begin' || normalized === 'rollback') return { rows: [] };
      if (normalized === 'set local synchronous_commit = on') return { rows: [] };
      if (normalized.includes('update research.participants')) {
        const current = updateIndex++;
        return current === missingUpdate ? { rows: [] } : { rows: [{ status: 'revoked' }] };
      }
      if (normalized === 'commit') {
        if (commitFails) throw new Error('simulated batch commit failure');
        return { rows: [] };
      }
      throw new Error('unexpected query');
    }
  };
};

test('Research acknowledges a whole capability-only batch only after synchronous commit', async () => {
  const client = makeClient();
  const batch = buildRelayBatch(capabilities(), 8, () => 0);
  const result = await acceptRevocationRelayBatchDurably(client, batch);

  assert.deepEqual(result, { accepted: true, durable: true });
  assert.equal(client.calls[0], 'BEGIN');
  assert.equal(client.calls[1], 'SET LOCAL synchronous_commit = on');
  assert.equal(client.calls.filter((sql) => /update research\.participants/i.test(sql)).length, 8);
  assert.equal(client.calls.at(-1), 'COMMIT');
  assert.deepEqual(Object.keys(result), ['accepted', 'durable']);
});

test('one unknown capability rolls back the whole batch and emits no durable acknowledgement', async () => {
  const client = makeClient({ missingUpdate: 3 });
  const batch = buildRelayBatch(capabilities(), 8, () => 0);
  const result = await acceptRevocationRelayBatchDurably(client, batch);

  assert.deepEqual(result, { accepted: false, durable: false });
  assert.equal(client.calls.at(-1), 'ROLLBACK');
  assert.equal(client.calls.includes('COMMIT'), false);
});

test('batch commit failure is never converted into a durable acknowledgement', async () => {
  const client = makeClient({ commitFails: true });
  const batch = buildRelayBatch(capabilities(), 8, () => 0);
  await assert.rejects(
    () => acceptRevocationRelayBatchDurably(client, batch),
    /simulated batch commit failure/
  );
  assert.equal(client.calls.at(-1), 'ROLLBACK');
});

test('invalid or correlating batch metadata is rejected before database access', async () => {
  const client = makeClient();
  const batch = buildRelayBatch(capabilities(), 8, () => 0);
  await assert.rejects(
    () => acceptRevocationRelayBatchDurably(client, { ...batch, requestedAt: 'forbidden' }),
    /Invalid relay batch envelope/
  );
  assert.equal(client.calls.length, 0);
});

test('durable batch service contains no Identity linkage or per-item receipt surface', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchDurableRevocationBatchService.js'),
    'utf8'
  ).toLowerCase();
  for (const forbidden of ['account_id', 'user_id', 'email', 'participant_id', 'receiptid', 'receipt_id']) {
    assert.equal(source.includes(forbidden), false, 'forbidden batch surface: ' + forbidden);
  }
});
