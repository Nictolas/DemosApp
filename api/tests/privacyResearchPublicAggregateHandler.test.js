const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createResearchPublicHandlers
} = require('../handlers/researchPublicHandlers');

const responseRecorder = () => {
  const state = { statusCode: null, body: null };
  return {
    state,
    res: {
      status(code) {
        state.statusCode = code;
        return this;
      },
      json(body) {
        state.body = body;
        return this;
      }
    }
  };
};

const fixedClock = () => new Date('2026-10-05T12:30:00Z');

test('unmounted aggregate handler publishes only live privacy-safe aggregate output', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [
        { answer_code: 'c', participant_count: '2', participant_id: 'internal-a' },
        { answer_code: 'f', participant_count: '9', participant_id: 'internal-b' }
      ] };
    }
  };
  const handlers = createResearchPublicHandlers({
    getPool: () => pool,
    aggregateMinimumCellSize: 5,
    aggregateClock: fixedClock
  });
  const out = responseRecorder();

  await handlers.readAnswerAggregates({
    body: { questionId: 'energia_nucleare' },
    user: { id: 'ambient-identity' },
    headers: { authorization: 'Bearer ambient' }
  }, out.res);

  assert.equal(out.state.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ['energia_nucleare']);
  assert.match(calls[0].sql, /research\.current_opinion_responses/i);
  assert.doesNotMatch(calls[0].sql, /account_id|user_id|email|identity\./i);
  assert.deepEqual(Object.keys(out.state.body).sort(), ['methodology', 'rows']);
  assert.equal(out.state.body.methodology.generatedAt, '2026-10-05T12:30:00.000Z');
  assert.equal(out.state.body.methodology.publicationMode, 'live-query');
  assert.equal(out.state.body.methodology.materialization, 'disabled');
  assert.equal(out.state.body.methodology.cacheTtlSeconds, 0);
  assert.deepEqual(out.state.body.rows, [
    { answerCode: 'f', suppressed: false, participantCount: 9 },
    { answerCode: 'c', suppressed: true, participantCount: null },
    { answerCode: 'i', suppressed: true, participantCount: null }
  ]);
  assert.equal(JSON.stringify(out.state.body).includes('internal-a'), false);
  assert.equal(JSON.stringify(out.state.body).includes('ambient-identity'), false);
});

test('aggregate handler fails closed when privacy threshold is not configured', async () => {
  let queryCalls = 0;
  const handlers = createResearchPublicHandlers({
    getPool: () => ({ query: async () => {
      queryCalls += 1;
      return { rows: [] };
    } })
  });
  const out = responseRecorder();

  await handlers.readAnswerAggregates({ body: { questionId: 'q-1' } }, out.res);

  assert.equal(out.state.statusCode, 400);
  assert.equal(queryCalls, 0);
  assert.deepEqual(out.state.body, { error: 'Invalid Research request' });
});

test('aggregate handler rejects caller-controlled policy and Identity fields before Research query', async () => {
  let queryCalls = 0;
  const handlers = createResearchPublicHandlers({
    getPool: () => ({ query: async () => {
      queryCalls += 1;
      return { rows: [] };
    } }),
    aggregateMinimumCellSize: 5,
    aggregateClock: fixedClock
  });

  for (const body of [
    { questionId: 'q-1', minimumCellSize: 1 },
    { questionId: 'q-1', generatedAt: '2099-01-01T00:00:00Z' },
    { questionId: 'q-1', email: 'identity@example.invalid' }
  ]) {
    const out = responseRecorder();
    await handlers.readAnswerAggregates({ body }, out.res);
    assert.equal(out.state.statusCode, 400);
  }
  assert.equal(queryCalls, 0);
});

test('aggregate handler rejects oversized question identifiers before Research query', async () => {
  let queryCalls = 0;
  const handlers = createResearchPublicHandlers({
    getPool: () => ({ query: async () => {
      queryCalls += 1;
      return { rows: [] };
    } }),
    aggregateMinimumCellSize: 5,
    aggregateClock: fixedClock
  });
  const out = responseRecorder();

  await handlers.readAnswerAggregates({ body: { questionId: 'q'.repeat(129) } }, out.res);

  assert.equal(out.state.statusCode, 400);
  assert.equal(queryCalls, 0);
});
