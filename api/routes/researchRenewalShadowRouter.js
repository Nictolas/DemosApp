const express = require('express');
const { getResearchPool } = require('../config/researchDatabase');
const {
  researchChallengeLimiter
} = require('../middleware/researchRateLimiting');
const {
  assertResearchPublicPayload
} = require('../services/researchPublicApiContract');
const {
  issueResearchRenewalProofChallenge
} = require('../services/researchVerifiedRenewalService');

const RESEARCH_RENEWAL_SHADOW_CHALLENGE_PATH = '/v1/renewal/proof-challenges';

const createResearchRenewalShadowRouter = ({
  getPool = getResearchPool,
  challengeLimiter = researchChallengeLimiter,
  issueChallenge = issueResearchRenewalProofChallenge
} = {}) => {
  const router = express.Router();

  router.post(
    RESEARCH_RENEWAL_SHADOW_CHALLENGE_PATH,
    challengeLimiter,
    async (req, res) => {
      try {
        const body = req.body ?? {};
        assertResearchPublicPayload(body, []);
        const result = await issueChallenge(getPool());
        res.status(201).json({
          challenge: result.challenge,
          purpose: result.purpose
        });
      } catch {
        res.status(400).json({ error: 'Invalid Research renewal challenge request' });
      }
    }
  );

  return router;
};

module.exports = {
  RESEARCH_RENEWAL_SHADOW_CHALLENGE_PATH,
  createResearchRenewalShadowRouter
};
