const test = require('node:test');
const assert = require('node:assert/strict');

const { issueCredentialOnce } = require('../services/identityCredentialIssuanceStore');
const { consumeCredentialOnce } = require('../services/researchCredentialRedemptionStore');
const { validateCredentialContext } = require('../services/credentialContextPolicy');

const createTransactionalClient = ({ insertRows = [{}], failInsert = false } = {}) => {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/^INSERT/i.test(sql.trim()) && failInsert) throw new Error('simulated insert failure');
      if (/^INSERT/i.test(sql.trim())) return { rows: insertRows };
      return { rows: [] };
    }
  };
};

test('credential context only accepts schema-compatible purpose and bounded epoch format', () => {
  assert.equal(validateCredentialContext({ purpose: 'enroll', epoch: '2026-Q4' }), true);
  assert.equal(validateCredentialContext({ purpose: 'renew', epoch: '2027-M01' }), true);
  assert.throws(() => validateCredentialContext({ purpose: 'other', epoch: '2026-Q4' }));
  assert.throws(() => validateCredentialContext({ purpose: 'enroll', epoch: 'forever' }));
});

test('Identity issuance commits its own transaction on success', async () => {
  const client = createTransactionalClient({
    insertRows: [{ issuance_id: 'issuance-1', issued_at: '2026-10-01T00:00:00Z' }]
  });
  const issued = await issueCredentialOnce(client, {
    accountId: '00000000-0000-0000-0000-000000000001',
    purpose: 'enroll',
    epoch: '2026-Q4'
  });

  assert.equal(issued.issuance_id, 'issuance-1');
  assert.equal(client.calls[0].sql, 'BEGIN');
  assert.match(client.calls[1].sql, /ON CONFLICT \(account_id, purpose, epoch\) DO NOTHING/i);
  assert.equal(client.calls[2].sql, 'COMMIT');
  assert.equal(client.calls.some(({ sql }) => sql === 'ROLLBACK'), false);
});

test('Identity issuance rolls back its own transaction on failure', async () => {
  const client = createTransactionalClient({ failInsert: true });
  await assert.rejects(() => issueCredentialOnce(client, {
    accountId: '00000000-0000-0000-0000-000000000001',
    purpose: 'enroll',
    epoch: '2026-Q4'
  }), /simulated insert failure/);
  assert.equal(client.calls[0].sql, 'BEGIN');
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
});

test('Research redemption commits independently and only reports first redemption', async () => {
  const first = createTransactionalClient({ insertRows: [{ redeemed_at: '2026-10-01T00:00:00Z' }] });
  const replay = createTransactionalClient({ insertRows: [] });
  const args = {
    credentialDigest: Buffer.from('digest'),
    purpose: 'enroll',
    epoch: '2026-Q4'
  };

  assert.equal(await consumeCredentialOnce(first, args), true);
  assert.equal(await consumeCredentialOnce(replay, args), false);
  assert.equal(first.calls[0].sql, 'BEGIN');
  assert.match(first.calls[1].sql, /ON CONFLICT \(credential_digest\) DO NOTHING/i);
  assert.equal(first.calls[2].sql, 'COMMIT');
});

test('Research redemption rolls back independently on failure', async () => {
  const client = createTransactionalClient({ failInsert: true });
  await assert.rejects(() => consumeCredentialOnce(client, {
    credentialDigest: Buffer.from('digest'),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), /simulated insert failure/);
  assert.equal(client.calls[0].sql, 'BEGIN');
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
});

test('no service composes Identity issuance and Research redemption in one transaction', () => {
  const identitySource = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'services', 'identityCredentialIssuanceStore.js'),
    'utf8'
  ).toLowerCase();
  const researchSource = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'services', 'researchCredentialRedemptionStore.js'),
    'utf8'
  ).toLowerCase();

  assert.equal(identitySource.includes('research.'), false);
  assert.equal(identitySource.includes('credential_digest'), false);
  assert.equal(researchSource.includes('identity.'), false);
  assert.equal(researchSource.includes('account_id'), false);
  assert.equal(researchSource.includes('user_id'), false);
});
