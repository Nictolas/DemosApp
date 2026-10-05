const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  createResearchIssuerPublicKeyRing
} = require('../services/researchIssuerPublicKeyRing');
const {
  createResearchPrivacyPassIssuerKeyRing
} = require('../services/researchPrivacyPassIssuerKeyRing');

const key = (label) => ({ type: 'public', usages: ['verify'], label });
const keyId = (byte) => Buffer.alloc(32, byte);

test('Research issuer key ring supports bounded two-key epoch overlap and exact key-id selection', () => {
  const oldKey = key('old');
  const newKey = key('new');
  const ring = createResearchIssuerPublicKeyRing({
    keys: [
      { keyId: keyId(1), publicKey: oldKey, epochs: ['2026-Q4'] },
      { keyId: keyId(2), publicKey: newKey, epochs: ['2026-Q4', '2027-Q1'] }
    ]
  });

  assert.equal(ring.activeKeyCount('2026-Q4'), 2);
  assert.equal(ring.activeKeyCount('2027-Q1'), 1);
  assert.equal(ring.resolve({ tokenKeyId: keyId(1), epoch: '2026-Q4' }), oldKey);
  assert.equal(ring.resolve({ tokenKeyId: keyId(2), epoch: '2026-Q4' }), newKey);
  assert.equal(ring.resolve({ tokenKeyId: keyId(1), epoch: '2027-Q1' }), null);
  assert.equal(ring.resolve({ tokenKeyId: keyId(9), epoch: '2026-Q4' }), null);
});

test('Research issuer key ids reject coercible objects and accept only binary views', () => {
  assert.throws(() => createResearchIssuerPublicKeyRing({
    keys: [{
      keyId: { valueOf: () => keyId(1) },
      publicKey: key('coercible'),
      epochs: ['2026-Q4']
    }]
  }), /key id/i);

  const typedId = new Uint8Array(32);
  typedId.fill(7);
  const typedKey = key('typed');
  const ring = createResearchIssuerPublicKeyRing({
    keys: [{ keyId: typedId, publicKey: typedKey, epochs: ['2026-Q4'] }]
  });
  assert.equal(ring.resolve({ tokenKeyId: typedId, epoch: '2026-Q4' }), typedKey);
});

test('Research issuer key resolution fails closed on absent or hostile input objects', () => {
  const ring = createResearchIssuerPublicKeyRing({
    keys: [{ keyId: keyId(8), publicKey: key('safe'), epochs: ['2026-Q4'] }]
  });
  assert.equal(ring.resolve(null), null);
  assert.equal(ring.resolve(undefined), null);

  const hostile = new Proxy({}, {
    get() {
      throw new Error('hostile getter');
    }
  });
  assert.equal(ring.resolve(hostile), null);
});

test('Research issuer key ring rejects private/signing capability and excessive overlap', () => {
  assert.throws(() => createResearchIssuerPublicKeyRing({
    keys: [{ keyId: keyId(1), publicKey: { type: 'private', usages: ['sign'] }, epochs: ['2026-Q4'] }]
  }), /public|verification/i);

  assert.throws(() => createResearchIssuerPublicKeyRing({
    keys: [
      { keyId: keyId(1), publicKey: key('a'), epochs: ['2026-Q4'] },
      { keyId: keyId(2), publicKey: key('b'), epochs: ['2026-Q4'] },
      { keyId: keyId(3), publicKey: key('c'), epochs: ['2026-Q4'] }
    ]
  }), /Too many/);
});

test('Privacy Pass key-ring builder derives token key ids only from issuer public keys', async () => {
  const a = key('a');
  const b = key('b');
  const bytesByKey = new Map([
    [a, Buffer.from('issuer-public-a')],
    [b, Buffer.from('issuer-public-b')]
  ]);
  const privacyPass = {
    publicVerif: {
      async getPublicKeyBytes(publicKey) {
        return bytesByKey.get(publicKey);
      }
    }
  };
  const ring = await createResearchPrivacyPassIssuerKeyRing({
    privacyPass,
    entries: [
      { publicKey: a, epochs: ['2026-Q4'] },
      { publicKey: b, epochs: ['2027-Q1'] }
    ]
  });

  const idA = crypto.createHash('sha256').update(bytesByKey.get(a)).digest();
  const idB = crypto.createHash('sha256').update(bytesByKey.get(b)).digest();
  assert.equal(ring.resolve({ tokenKeyId: idA, epoch: '2026-Q4' }), a);
  assert.equal(ring.resolve({ tokenKeyId: idB, epoch: '2027-Q1' }), b);
});
