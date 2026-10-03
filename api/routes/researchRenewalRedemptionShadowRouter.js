const express = require('express');
const { getResearchPool } = require('../config/researchDatabase');
const {
  researchRenewalLimiter
} = require('../middleware/researchRateLimiting');
const {
  assertResearchPublicPayload
} = require('../services/researchPublicApiContract');
const {
  verifyAndRedeemRenewalWithParticipantProof
} = require('../services/researchVerifiedRenewalService');

const RESEARCH_RENEWAL_REDEMPTION_SHADOW_PATH = '/v1/renewal/redeem';
const RESEARCH_RENEWAL_REDEMPTION_REQUEST_KEYS = Object.freeze([
  'credential',
  'epoch',
  'participantPublicKey',
  'challenge',
  'signature'
]);
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MIN_CREDENTIAL_BYTES = 32;
const MAX_CREDENTIAL_BYTES = 4096;

const decodeBase64UrlBounded = (value, minLength, maxLength, label) => {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) {
    throw new Error('Invalid ' + label);
  }
  const decoded = Buffer.from(value, 'base64url');
  if (
    decoded.length < minLength ||
    decoded.length > maxLength ||
    decoded.toString('base64url') !== value
  ) {
    throw new Error('Invalid ' + label);
  }
  return decoded;
};

const decodeBase64UrlExact = (value, expectedLength, label) =>
  decodeBase64UrlBounded(value, expectedLength, expectedLength, label);

const createResearchRenewalRedemptionShadowRouter = ({
  getPool = getResearchPool,
  renewalLimiter = researchRenewalLimiter,
  redeemRenewal = verifyAndRedeemRenewalWithParticipantProof,
  credentialVerifier,
  participantProofVerifier
} = {}) => {
  const router = express.Router();

  router.post(
    RESEARCH_RENEWAL_REDEMPTION_SHADOW_PATH,
    renewalLimiter,
    async (req, res) => {
      try {
        const body = req.body ?? {};
        assertResearchPublicPayload(body, RESEARCH_RENEWAL_REDEMPTION_REQUEST_KEYS);
        if (
          Object.keys(body).length !== RESEARCH_RENEWAL_REDEMPTION_REQUEST_KEYS.length ||
          RESEARCH_RENEWAL_REDEMPTION_REQUEST_KEYS.some(
            (key) => !Object.prototype.hasOwnProperty.call(body, key)
          )
        ) {
          throw new Error('Invalid Research renewal redemption request');
        }

        const credentialBytes = decodeBase64UrlBounded(
          body.credential,
          MIN_CREDENTIAL_BYTES,
          MAX_CREDENTIAL_BYTES,
          'renewal credential'
        );
        const participantPublicKey = decodeBase64UrlExact(
          body.participantPublicKey,
          32,
          'participant public key'
        );
        const signature = decodeBase64UrlExact(
          body.signature,
          64,
          'participant signature'
        );
        decodeBase64UrlExact(body.challenge, 32, 'renewal challenge');
        if (typeof body.epoch !== 'string') {
          throw new Error('Invalid renewal epoch');
        }

        const result = await redeemRenewal(
          getPool(),
          {
            credentialBytes,
            epoch: body.epoch,
            participantPublicKey,
            challenge: body.challenge,
            signature
          },
          credentialVerifier,
          participantProofVerifier
        );

        if (!result || result.redeemed !== true) {
          throw new Error('Research renewal redemption rejected');
        }

        res.status(200).json({ renewed: true });
      } catch {
        res.status(400).json({ error: 'Invalid or replayed Research renewal request' });
      }
    }
  );

  return router;
};

module.exports = {
  RESEARCH_RENEWAL_REDEMPTION_SHADOW_PATH,
  RESEARCH_RENEWAL_REDEMPTION_REQUEST_KEYS,
  MIN_CREDENTIAL_BYTES,
  MAX_CREDENTIAL_BYTES,
  decodeBase64UrlBounded,
  decodeBase64UrlExact,
  createResearchRenewalRedemptionShadowRouter
};
