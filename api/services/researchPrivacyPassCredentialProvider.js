const crypto = require('crypto');
const { validateCredentialContext } = require('./credentialContextPolicy');

const CREDENTIAL_CONTEXT_DOMAIN = 'demos.research.credential-context.v1';
const DEFAULT_ISSUER_NAME = 'identity.demos.invalid';
const DEFAULT_ORIGIN_INFO = Object.freeze(['research.demos.invalid']);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();

const buildCredentialRedemptionContext = ({ purpose, epoch }) => {
  validateCredentialContext({ purpose, epoch });
  return sha256(Buffer.from(
    `${CREDENTIAL_CONTEXT_DOMAIN}\u0000${purpose}\u0000${epoch}`,
    'utf8'
  ));
};

const buffersEqual = (left, right) => {
  const a = Buffer.from(left || []);
  const b = Buffer.from(right || []);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const assertPrivacyPassVerificationApi = (privacyPass) => {
  if (
    !privacyPass ||
    typeof privacyPass.Token?.deserialize !== 'function' ||
    typeof privacyPass.publicVerif?.Origin !== 'function' ||
    typeof privacyPass.publicVerif?.getPublicKeyBytes !== 'function' ||
    !privacyPass.publicVerif?.BLIND_RSA ||
    privacyPass.publicVerif?.BlindRSAMode?.PSS === undefined
  ) {
    throw new Error('Privacy Pass public-verifiable verification API is required');
  }
};

const createResearchPrivacyPassCredentialProvider = ({
  privacyPass,
  issuerPublicKey,
  issuerName = DEFAULT_ISSUER_NAME,
  originInfo = DEFAULT_ORIGIN_INFO
}) => {
  assertPrivacyPassVerificationApi(privacyPass);
  if (!issuerPublicKey) {
    throw new Error('Privacy Pass issuer public key is required');
  }
  if (typeof issuerName !== 'string' || issuerName.length === 0) {
    throw new Error('Privacy Pass issuer name is required');
  }
  if (!Array.isArray(originInfo) || originInfo.length === 0) {
    throw new Error('Privacy Pass Research origin info is required');
  }

  const {
    BlindRSAMode,
    BLIND_RSA,
    Origin,
    getPublicKeyBytes
  } = privacyPass.publicVerif;

  const origin = new Origin(BlindRSAMode.PSS, [...originInfo]);

  return Object.freeze({
    async verify({ credentialBytes, purpose, epoch }) {
      try {
        validateCredentialContext({ purpose, epoch });
        if (!Buffer.isBuffer(credentialBytes) || credentialBytes.length === 0) {
          return { valid: false };
        }

        const token = privacyPass.Token.deserialize(
          BLIND_RSA,
          new Uint8Array(credentialBytes)
        );

        const redemptionContext = buildCredentialRedemptionContext({ purpose, epoch });
        const expectedChallenge = origin.createTokenChallenge(
          issuerName,
          new Uint8Array(redemptionContext)
        );
        const expectedChallengeDigest = sha256(
          Buffer.from(expectedChallenge.serialize())
        );

        if (!buffersEqual(token.authInput?.challengeDigest, expectedChallengeDigest)) {
          return { valid: false };
        }

        const issuerPublicKeyBytes = await getPublicKeyBytes(issuerPublicKey);
        const expectedTokenKeyId = sha256(Buffer.from(issuerPublicKeyBytes));
        if (!buffersEqual(token.authInput?.tokenKeyId, expectedTokenKeyId)) {
          return { valid: false };
        }

        const valid = await origin.verify(token, issuerPublicKey);
        return valid === true
          ? { valid: true, credentialVersion: 1 }
          : { valid: false };
      } catch {
        return { valid: false };
      }
    }
  });
};

module.exports = {
  CREDENTIAL_CONTEXT_DOMAIN,
  DEFAULT_ISSUER_NAME,
  DEFAULT_ORIGIN_INFO,
  buildCredentialRedemptionContext,
  createResearchPrivacyPassCredentialProvider
};
