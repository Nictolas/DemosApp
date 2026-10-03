const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  redeemEnrollmentCredential
} = require('../services/researchEnrollmentRedemptionService');

const makeClient = ({ replay = false, failParticipant = false, participantConflict = false } = {}) => {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const normalized = sql.trim().toLowerCase();
      if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
        return { rows: [] };
      }
      if (normalized.includes('insert into research.spent_credentials')) {
        return replay ? { rows: [] } : { rows: [{ redeemed_at: '2026-10-01T00:00:00Z' }] };
      }
      if (normalized.includes('insert into research.participants')) {
        if (failParticipant) throw new Error('simulated participant failure');
        if (participantConflict) return { rows: [] };
        return { rows: [{
          participant_id: '11111111-1111-1111-1111-111111111111',
          key_algorithm: 'ed25519',
          credential_version: 1,
          status: 'active'
        }] };
      }
      throw new Error('unexpected query');
    }
  };
};

const args = {
  credentialDigest: Buffer.from('unlinkable-credential-digest'),
  purpose: 'enroll',
  epoch: '2026-Q4',
  participantPublicKey: Buffer.from('participant-public-key'),
  revocationCapability: Buffer.alloc(32, 7),
  keyAlgorithm: 'ed25519',
  credentialVersion: 1
};

test('Research enrollment commits spent marker and pseudonymous participant atomically', async () => {
  const client = makeClient();
  const result = await redeemEnrollmentCredential(client, args);

  assert.equal(result.redeemed, true);
  assert.equal(result.participant.participant_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(client.calls[0].sql, 'BEGIN');
  assert.match(client.calls[1].sql, /research\.spent_credentials/i);
  assert.match(client.calls[2].sql, /research\.participants/i);
  assert.equal(client.calls[3].sql, 'COMMIT');
});

test('Research enrollment persists only the digest of the opaque revocation capability', async () => {
  const client = makeClient();
  await redeemEnrollmentCredential(client, args);
  const insert = client.calls.find(({ sql }) => /insert into research\.participants/i.test(sql));
  const expectedDigest = crypto.createHash('sha256').update(args.revocationCapability).digest();

  assert.match(insert.sql, /revocation_capability_digest/i);
  assert.equal(insert.params.some((value) => Buffer.isBuffer(value) && value.equals(expectedDigest)), true);
  assert.equal(insert.params.some((value) => Buffer.isBuffer(value) && value.equals(args.revocationCapability)), false);
});

test('Research replay rolls back before participant mutation', async () => {
  const client = makeClient({ replay: true });
  const result = await redeemEnrollmentCredential(client, args);

  assert.deepEqual(result, { redeemed: false, participant: null });
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(
    client.calls.some(({ sql }) => /research\.participants/i.test(sql)),
    false
  );
});

test('participant failure rolls back the spent marker transaction', async () => {
  const client = makeClient({ failParticipant: true });
  await assert.rejects(
    () => redeemEnrollmentCredential(client, args),
    /simulated participant failure/
  );
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(client.calls.some(({ sql }) => sql === 'COMMIT'), false);
});

test('existing participant key cannot be re-enrolled or reactivated', async () => {
  const client = makeClient({ participantConflict: true });
  const result = await redeemEnrollmentCredential(client, args);
  const insert = client.calls.find(({ sql }) => /insert into research\.participants/i.test(sql));

  assert.deepEqual(result, { redeemed: false, participant: null });
  assert.match(insert.sql, /ON CONFLICT \(participant_public_key\) DO NOTHING/i);
  assert.doesNotMatch(insert.sql, /status\s*=\s*'active'/i);
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
});

test('validation rejects invalid purpose/key/version/capability before opening a transaction', async () => {
  for (const invalid of [
    { ...args, purpose: 'renew' },
    { ...args, keyAlgorithm: 'rsa' },
    { ...args, credentialVersion: 0 },
    { ...args, revocationCapability: undefined },
    { ...args, revocationCapability: Buffer.alloc(16) }
  ]) {
    const client = makeClient();
    await assert.rejects(() => redeemEnrollmentCredential(client, invalid));
    assert.equal(client.calls.length, 0);
  }
});

test('Research enrollment service has no Identity/account mapping surface', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchEnrollmentRedemptionService.js'),
    'utf8'
  ).toLowerCase();

  for (const forbidden of [
    'identity.',
    'account_id',
    'user_id',
    'email',
    'fiscal_number',
    'participant_id, credential_digest'
  ]) {
    assert.equal(source.includes(forbidden), false, 'forbidden linkage surface: ' + forbidden);
  }
});
