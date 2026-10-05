const express = require('express');
const {
  createResearchPublicHandlers
} = require('../handlers/researchPublicHandlers');
const {
  researchChallengeLimiter,
  researchReadLimiter
} = require('../middleware/researchRateLimiting');
const {
  RESEARCH_PUBLIC_ENDPOINTS
} = require('../services/researchPublicApiContract');

const createResearchPublicRouter = ({
  handlers = createResearchPublicHandlers(),
  challengeLimiter = researchChallengeLimiter,
  readLimiter = researchReadLimiter
} = {}) => {
  const router = express.Router();

  router.post(
    RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.path,
    challengeLimiter,
    handlers.issueChallenge
  );
  router.post(
    RESEARCH_PUBLIC_ENDPOINTS.listPoliticalVectors.path,
    readLimiter,
    handlers.listPoliticalVectors
  );
  router.post(
    RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.path,
    readLimiter,
    handlers.readOpinionVector
  );
  router.post(
    RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.path,
    readLimiter,
    handlers.readAnswerAggregates
  );

  return router;
};

module.exports = {
  createResearchPublicRouter
};
