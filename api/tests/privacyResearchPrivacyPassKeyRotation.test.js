const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  buildCredentialRedemptionContext,
  createResearchPrivacyPassCredentialProvider
} = require('../services/researchPrivacyPassCredentialProvider');
const {
  createResearchIssuerPublicKeyRing
} = require('../services/researchIssuerPublicKeyRing');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

const makePrivacyPass = ({ token, expectedKey, issuerName, originInfo }) => {
  class Origin {
    createTokenChallenge(name, redemptionContext) {
      return {
        serialize: () => Buffer.concat([
          Buffer.from(name, 'utf8'),
          Buffer.from([0]),
          Buffer.from(redemptionContext),
          Buffer.from([0]),
          Buffer.from(originInfo.join(','), 'utf8')
        ])
      };
    }
    async verify(_token, key) {
      return key === expectedKey;
    }
  }

  return {
    Token: { deserialize: () => token },
    publicVerif: {
      BlindRSAMode: { PSS: 48 },
      BLIND_RSA: { value: 2 },
      Origin,
      getPublicKeyBytes: async () => Buffer.from('unused-with-key-ring')
    }
  };
};

test('Privacy Pass provider selects the rotated public key from token key id and epoch', async () => {
  const issuerName = 'identity.demos.invalid';
  const originInfo = ['research.demos.invalid'];
  const oldKey = { type: 'public', usages: ['verify'], label: 'old' };
  const newKey = { type: 'public', usages: ['verify'], label: 'new' };
  const oldId = Buffer.alloc(32, 1);
  const newId = Buffer.alloc(32, 2);
  const epoch = '2027-Q1';
  const redemptionContext = buildCredentialRedemptionContext({ purpose: 'renew', epoch });
  const challenge = Buffer.concat([
    Buffer.from(issuerName, 'utf8'),
    Buffer.from([0]),
    redemptionContext,
    Buffer.from([0]),
    Buffer.from(originInfo.join(','), 'utf8')
  ]);
  const token = {
    authInput: {
      challengeDigest: sha256(challenge),
      tokenKeyId: newId
    }
  };
  const ring = createResearchIssuerPublicKeyRing({
    keys: [
      { keyId: oldId, publicKey: oldKey, epochs: ['2026-Q4'] },
      { keyId: newId, publicKey: newKey, epochs: ['2026-Q4', '2027-Q1'] }
    ]
  });
  const provider = createResearchPrivacyPassCredentialProvider({
    privacyPass: makePrivacyPass({ token, expectedKey: newKey, issuerName, originInfo }),
    issuerPublicKeyRing: ring,
    issuerName,
    originInfo
  });

  assert.deepEqual(await provider.verify({
    credentialBytes: Buffer.alloc(64, 1),
    purpose: 'renew',
    epoch
  }), { valid: true, credentialVersion: 1 });
});

test('Privacy Pass provider fails closed when token key id is unknown to the epoch key ring', async () => {
  const issuerName = 'identity.demos.invalid';
  const originInfo = ['research.demos.invalid'];
  const publicKey = { type: 'public', usages: ['verify'] };
  const epoch = '2026-Q4';
  const redemptionContext = buildCredentialRedemptionContext({ purpose: 'renew', epoch });
  const challenge = Buffer.concat([
    Buffer.from(issuerName, 'utf8'),
    Buffer.from([0]),
    redemptionContext,
    Buffer.from([0]),
    Buffer.from(originInfo.join(','), 'utf8')
  ]);
  const token = {
    authInput: {
      challengeDigest: sha256(challenge),
      tokenKeyId: Buffer.alloc(32, 9)
    }
  };
  const ring = createResearchIssuerPublicKeyRing({
    keys: [{ keyId: Buffer.alloc(32, 1), publicKey, epochs: [epoch] }]
  });
  const provider = createResearchPrivacyPassCredentialProvider({
    privacyPass: makePrivacyPass({ token, expectedKey: publicKey, issuerName, originInfo }),
    issuerPublicKeyRing: ring,
    issuerName,
    originInfo
  });

  assert.deepEqual(await provider.verify({
    credentialBytes: Buffer.alloc(64, 1),
    purpose: 'renew',
    epoch
  }), { valid: false });
});
