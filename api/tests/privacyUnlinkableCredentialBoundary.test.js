const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  digestPresentedCredential,
  verifyUnlinkableCredential
} = require('../services/unlinkableCredentialVerifier');

const bytes = crypto.randomBytes(48);

test('presented credential digest is deterministic locally and does not include Identity input', () => {
  const first = digestPresentedCredential(bytes);
  const second = digestPresentedCredential(Buffer.from(bytes));
  assert.equal(first.equals(second), true);
  assert.equal(first.length, 32);
});

test('verification requires an injected unlinkable verifier', async () => {
  await assert.rejects(
    () => verifyUnlinkableCredential({
      credentialBytes: bytes,
      purpose: 'enroll',
      epoch: '2026-Q4'
    }),
    /verifier is required/
  );
});

test('invalid cryptographic proof is rejected before redemption', async () => {
  await assert.rejects(
    () => verifyUnlinkableCredential({
      credentialBytes: bytes,
      purpose: 'enroll',
      epoch: '2026-Q4',
      verifier: { verify: async () => ({ valid: false }) }
    }),
    /Invalid unlinkable credential/
  );
});

test('verifier output carrying an Identity handle is rejected', async () => {
  for (const leaked of [
    { accountId: 'account-1' },
    { user_id: 'user-1' },
    { email: 'person@example.test' },
    { subject: 'oidc-subject' }
  ]) {
    await assert.rejects(
      () => verifyUnlinkableCredential({
        credentialBytes: bytes,
        purpose: 'enroll',
        epoch: '2026-Q4',
        verifier: { verify: async () => ({ valid: true, credentialVersion: 1, ...leaked }) }
      }),
      /leaked Identity linkage/
    );
  }
});

test('valid unlinkable verifier returns only digest and version to Research', async () => {
  const result = await verifyUnlinkableCredential({
    credentialBytes: bytes,
    purpose: 'enroll',
    epoch: '2026-Q4',
    verifier: {
      verify: async ({ purpose, epoch }) => {
        assert.equal(purpose, 'enroll');
        assert.equal(epoch, '2026-Q4');
        return { valid: true, credentialVersion: 2, proofSuite: 'placeholder-unlinkable-suite' };
      }
    }
  });

  assert.deepEqual(Object.keys(result).sort(), ['credentialDigest', 'credentialVersion']);
  assert.equal(result.credentialVersion, 2);
  assert.equal(result.credentialDigest.equals(crypto.createHash('sha256').update(bytes).digest()), true);
});
