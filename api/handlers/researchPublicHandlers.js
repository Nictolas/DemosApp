const {
  getResearchPool,
  withResearchDatabaseBoundary
} = require('../config/researchDatabase');
const {
  issueResearchProofChallenge
} = require('../services/researchProofChallengeStore');
const {
  createResearchOpinionVectorReader
} = require('../services/researchOpinionVectorReader');
const {
  createResearchPoliticalVectorAdapter
} = require('../services/researchPoliticalVectorAdapter');
const {
  readPublishedResearchAnswerAggregates
} = require('../services/researchAggregateReader');
const {
  buildResearchAggregatePublicResponse
} = require('../services/researchAggregatePublicResponsePolicy');
const {
  RESEARCH_PUBLIC_ENDPOINTS,
  assertResearchPublicPayload
} = require('../services/researchPublicApiContract');
const {
  buildResearchPoliticalVectorsPublicResponse,
  buildResearchOpinionVectorPublicResponse
} = require('../services/researchPublicVectorResponsePolicy');
const {
  sendResearchPublicError
} = require('../services/researchPublicErrorPolicy');
const {
  classifyResearchFailure
} = require('../services/researchFailureClassification');
const {
  createResearchFailureDiagnostics
} = require('../services/researchFailureDiagnostics');
const { readCallableProperty } = require('../services/researchSafeInjection');

const normalizeFailureDiagnostics = (candidate) => {
  const record = readCallableProperty(candidate, 'record');
  if (!record) {
    return createResearchFailureDiagnostics();
  }
  return Object.freeze({
    record(classification) {
      try {
        Reflect.apply(record, candidate, [classification]);
      } catch {}
    }
  });
};

const decodeBase64UrlExact = (value, length, label) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid ' + label);
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length !== length || decoded.toString('base64url') !== value) {
    throw new Error('Invalid ' + label);
  }
  return decoded;
};

const createResearchPublicHandlers = ({
  getPool = getResearchPool,
  aggregateMinimumCellSize,
  aggregateClock,
  failureDiagnostics = createResearchFailureDiagnostics()
} = {}) => {
  const diagnostics = normalizeFailureDiagnostics(failureDiagnostics);
  return ({
  async issueChallenge(req, res) {
    try {
      const body = req.body ?? {};
      assertResearchPublicPayload(body, RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.requestKeys);
      const result = await withResearchDatabaseBoundary((pool) => issueResearchProofChallenge(pool), getPool);
      res.status(201).json({
        challenge: result.challenge,
        purpose: result.purpose
      });
    } catch (error) {
      diagnostics.record(classifyResearchFailure(error));
      sendResearchPublicError(res, 400);
    }
  },

  async listPoliticalVectors(req, res) {
    try {
      const body = req.body ?? {};
      assertResearchPublicPayload(body, RESEARCH_PUBLIC_ENDPOINTS.listPoliticalVectors.requestKeys);
      const candidates = await withResearchDatabaseBoundary((pool) =>
        createResearchPoliticalVectorAdapter({ client: pool }).read(body.scope)
      , getPool);
      res.status(200).json(buildResearchPoliticalVectorsPublicResponse(candidates));
    } catch (error) {
      diagnostics.record(classifyResearchFailure(error));
      sendResearchPublicError(res, 400);
    }
  },

  async readOpinionVector(req, res) {
    try {
      const body = req.body ?? {};
      assertResearchPublicPayload(body, RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.requestKeys);
      const proof = {
        participantPublicKey: decodeBase64UrlExact(body.participantPublicKey, 32, 'participant public key'),
        challenge: body.challenge,
        signature: decodeBase64UrlExact(body.signature, 64, 'participant signature')
      };
      const result = await withResearchDatabaseBoundary((pool) =>
        createResearchOpinionVectorReader({ client: pool }).read(proof)
      , getPool);
      res.status(200).json(buildResearchOpinionVectorPublicResponse(result));
    } catch (error) {
      diagnostics.record(classifyResearchFailure(error));
      sendResearchPublicError(res, 400);
    }
  },

  async readAnswerAggregates(req, res) {
    try {
      const body = req.body ?? {};
      assertResearchPublicPayload(body, RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.requestKeys);
      const result = await withResearchDatabaseBoundary((pool) =>
        readPublishedResearchAnswerAggregates(
          pool,
          {
            questionId: body.questionId,
            minimumCellSize: aggregateMinimumCellSize
          },
          { clock: aggregateClock }
        ),
        getPool
      );
      const response = buildResearchAggregatePublicResponse(result);
      res.status(200).json(response);
    } catch (error) {
      diagnostics.record(classifyResearchFailure(error));
      sendResearchPublicError(res, 400);
    }
  }
  });
};

module.exports = {
  normalizeFailureDiagnostics,
  decodeBase64UrlExact,
  createResearchPublicHandlers
};
