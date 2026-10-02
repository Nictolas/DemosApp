const {
  getResearchPool
} = require('../config/researchDatabase');
const {
  issueResearchProofChallenge
} = require('../services/researchProofChallengeStore');
const {
  createResearchOpinionVectorReader
} = require('../services/researchOpinionVectorReader');
const { createResearchPoliticalVectorAdapter } = require('../services/researchPoliticalVectorAdapter');
const {
  RESEARCH_PUBLIC_ENDPOINTS,
  assertResearchPublicPayload
} = require('../services/researchPublicApiContract');

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

const createResearchPublicHandlers = ({ getPool = getResearchPool } = {}) => ({
  async issueChallenge(req, res) {
    try {
      const body = req.body ?? {};
      assertResearchPublicPayload(body, RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.requestKeys);
      const result = await issueResearchProofChallenge(getPool());
      res.status(201).json({
        challenge: result.challenge,
        purpose: result.purpose
      });
    } catch {
      res.status(400).json({ error: 'Invalid Research challenge request' });
    }
  },

  async listPoliticalVectors(req, res) {
    try {
      const body = req.body ?? {};
      assertResearchPublicPayload(body, RESEARCH_PUBLIC_ENDPOINTS.listPoliticalVectors.requestKeys);
      const candidates = await createResearchPoliticalVectorAdapter({ client: getPool() }).read(body.scope);
      res.status(200).json({ candidates });
    } catch {
      res.status(400).json({ error: 'Invalid political vector request' });
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
      const result = await createResearchOpinionVectorReader({ client: getPool() }).read(proof);
      res.status(200).json({ opinions: result.opinions });
    } catch {
      res.status(400).json({ error: 'Invalid or replayed Research proof' });
    }
  }
});

module.exports = {
  decodeBase64UrlExact,
  createResearchPublicHandlers
};
