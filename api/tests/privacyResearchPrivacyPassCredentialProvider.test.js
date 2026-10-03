const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  buildCredentialRedemptionContext,
  createResearchPrivacyPassCredentialProvider
} = require('../services/researchPrivacyPassCredentialProvider');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

const createPrivacyPassStub = ({ token, issuerPublicKeyBytes, verification = true }) => {
  class Origin {
    constructor(mode, originInfo) {
      this.mode = mode;
      this.originInfo = originInfo;
    }

    createTokenChallenge(issuerName, redemptionContext) {
      const serializedOriginInfo = this.originInfo.join(',');
      return {
        serialize: () => Buffer.concat([
          Buffer.from(issuerName, 'utf8'),
          Buffer.from([0]),
          Buffer.from(redemptionContext),
          Buffer.from([0]),
          Buffer.from(serializedOriginInfo, 'utf8')
        ])
      };
    }

    async verify() {
      return verification;
    }
  }

  return {
    Token: {
      deserialize() {
        return token;
      }
    },
    publicVerif: {
      BlindRSAMode: { PSS: 48 },
      BLIND_RSA: { value: 2 },
      Origin,
      async getPublicKeyBytes() {
        return issuerPublicKeyBytes;
      }
    }
  };
};

const buildTokenForContext = ({ purpose, epoch, issuerName, originInfo, issuerPublicKeyBytes }) => {
  const redemptionContext = buildCredentialRedemptionContext({ purpose, epoch });
  const serializedChallenge = Buffer.concat([
    Buffer.from(issuerName, 'utf8'),
    Buffer.from([0]),
    redemptionContext,
    Buffer.from([0]),
    Buffer.from(originInfo, 'utf8')
  ]);

  return {
    authInput: {
      challengeDigest: sha256(serializedChallenge),
      tokenKeyId: sha256(Buffer.from(issuerPublicKeyBytes))
    }
  };
};

test('Privacy Pass credential context binds purpose and epoch to a 32-byte redemption context', () => {
  const enroll = buildCredentialRedemptionContext({ purpose: 'enroll', epoch: '2026-Q4' });
  const renew = buildCredentialRedemptionContext({ purpose: 'renew', epoch: '2026-Q4' });
  const nextEpoch = buildCredentialRedemptionContext({ purpose: 'renew', epoch: '2027-Q1' });

  assert.equal(enroll.length, 32);
  assert.equal(renew.length, 32);
  assert.equal(nextEpoch.length, 32);
  assert.notDeepEqual(enroll, renew);
  assert.notDeepEqual(renew, nextEpoch);
});

test('Privacy Pass provider verifies signature only after challenge context and issuer key id match', async () => {
  const issuerName = 'identity.demos.invalid';
  const originInfo = ['research.demos.invalid'];
  const issuerPublicKeyBytes = Buffer.from('issuer-public-key-fixture');
  const token = buildTokenForContext({
    purpose: 'renew',
    epoch: '2026-Q4',
    issuerName,
    originInfo: originInfo.join(','),
    issuerPublicKeyBytes
  });
  const privacyPass = createPrivacyPassStub({ token, issuerPublicKeyBytes });
  const provider = createResearchPrivacyPassCredentialProvider({
    privacyPass,
    issuerPublicKey: { type: 'public' },
    issuerName,
    originInfo
  });

  assert.deepEqual(
    await provider.verify({
      credentialBytes: Buffer.alloc(64, 1),
      purpose: 'renew',
      epoch: '2026-Q4'
    }),
    { valid: true, credentialVersion: 1 }
  );

  assert.deepEqual(
    await provider.verify({
      credentialBytes: Buffer.alloc(64, 1),
      purpose: 'renew',
      epoch: '2027-Q1'
    }),
    { valid: false }
  );
});

test('Privacy Pass provider fails closed for wrong issuer key id or failed cryptographic verification', async () => {
  const issuerName = 'identity.demos.invalid';
  const originInfo = ['research.demos.invalid'];
  const issuerPublicKeyBytes = Buffer.from('issuer-public-key-fixture');
  const token = buildTokenForContext({
    purpose: 'renew',
    epoch: '2026-Q4',
    issuerName,
    originInfo: originInfo.join(','),
    issuerPublicKeyBytes
  });

  const wrongKeyToken = {
    ...token,
    authInput: {
      ...token.authInput,
      tokenKeyId: Buffer.alloc(32, 0)
    }
  };
  const wrongKeyProvider = createResearchPrivacyPassCredentialProvider({
    privacyPass: createPrivacyPassStub({ token: wrongKeyToken, issuerPublicKeyBytes }),
    issuerPublicKey: { type: 'public' },
    issuerName,
    originInfo
  });
  assert.deepEqual(
    await wrongKeyProvider.verify({
      credentialBytes: Buffer.alloc(64, 1),
      purpose: 'renew',
      epoch: '2026-Q4'
    }),
    { valid: false }
  );

  const invalidSignatureProvider = createResearchPrivacyPassCredentialProvider({
    privacyPass: createPrivacyPassStub({
      token,
      issuerPublicKeyBytes,
      verification: false
    }),
    issuerPublicKey: { type: 'public' },
    issuerName,
    originInfo
  });
  assert.deepEqual(
    await invalidSignatureProvider.verify({
      credentialBytes: Buffer.alloc(64, 1),
      purpose: 'renew',
      epoch: '2026-Q4'
    }),
    { valid: false }
  );
});
