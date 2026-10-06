import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  openRevocationCapability,
  sealRevocationCapability,
} from '../services/identityRevocationEscrowEnvelope.js';

test('round-trips a 256-bit revocation capability with account-bound AAD', () => {
  const key = crypto.randomBytes(32);
  const capability = crypto.randomBytes(32);
  const envelope = sealRevocationCapability({ capability, accountId: 'acct-1', key, keyVersion: 7 });

  assert.equal(envelope.version, 1);
  assert.equal(envelope.keyVersion, 7);
  assert.equal('accountId' in envelope, false);
  assert.equal('participantId' in envelope, false);
  assert.deepEqual(openRevocationCapability({ envelope, accountId: 'acct-1', key }), capability);
});

test('fails closed for wrong account, wrong key, tampering, weak capability and invalid key version', () => {
  const key = crypto.randomBytes(32);
  const capability = crypto.randomBytes(32);
  const envelope = sealRevocationCapability({ capability, accountId: 'acct-1', key, keyVersion: 1 });

  assert.throws(() => openRevocationCapability({ envelope, accountId: 'acct-2', key }));
  assert.throws(() => openRevocationCapability({ envelope, accountId: 'acct-1', key: crypto.randomBytes(32) }));
  assert.throws(() => openRevocationCapability({
    envelope: { ...envelope, ciphertext: Buffer.from(crypto.randomBytes(32)).toString('base64url') },
    accountId: 'acct-1',
    key,
  }));
  assert.throws(() => sealRevocationCapability({ capability: crypto.randomBytes(31), accountId: 'acct-1', key, keyVersion: 1 }));
  assert.throws(() => sealRevocationCapability({ capability, accountId: 'acct-1', key, keyVersion: 0 }));
});
