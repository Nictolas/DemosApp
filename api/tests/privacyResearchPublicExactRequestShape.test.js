const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_PUBLIC_ENDPOINTS,
  assertResearchPublicPayload
} = require('../services/researchPublicApiContract');
const {
  createResearchPublicHandlers
} = require('../handlers/researchPublicHandlers');

const responseRecorder = () => {
  const state = { statusCode: null, body: null };
  return {
    state,
    res: {
      status(code) { state.statusCode = code; return this; },
      json(body) { state.body = body; return this; }
    }
  };
};

test('Research public payload contract requires every endpoint-declared request key', () => {
  assert.equal(assertResearchPublicPayload({}, RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.requestKeys), true);
  assert.throws(
    () => assertResearchPublicPayload({}, RESEARCH_PUBLIC_ENDPOINTS.listPoliticalVectors.requestKeys),
    /Missing Research public boundary field: scope/
  );
  assert.throws(
    () => assertResearchPublicPayload(
      { participantPublicKey: 'x', challenge: 'y' },
      RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.requestKeys
    ),
    /Missing Research public boundary field: signature/
  );
  assert.throws(
    () => assertResearchPublicPayload({}, RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.requestKeys),
    /Missing Research public boundary field: questionId/
  );
});

test('Research public payload contract remains exact and rejects extra fields', () => {
  assert.throws(
    () => assertResearchPublicPayload(
      { questionId: 'q1', extra: true },
      RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.requestKeys
    ),
    /Unexpected Research public boundary field: extra/
  );
});

test('missing required Research fields fail before any database pool access', async () => {
  let poolCalls = 0;
  const handlers = createResearchPublicHandlers({
    getPool: () => {
      poolCalls += 1;
      throw new Error('database must not be touched');
    }
  });

  for (const [handler, body] of [
    [handlers.listPoliticalVectors, {}],
    [handlers.readOpinionVector, { participantPublicKey: 'x', challenge: 'y' }],
    [handlers.readAnswerAggregates, {}]
  ]) {
    const out = responseRecorder();
    await handler({ body }, out.res);
    assert.equal(out.state.statusCode, 400);
  }

  assert.equal(poolCalls, 0);
});
