const test = require('node:test');
const assert = require('node:assert/strict');

const { createResearchPublicHandlers } = require('../handlers/researchPublicHandlers');

const responseRecorder = () => {
  const state = { statusCode: null, body: null };
  return {
    state,
    res: {
      setHeader() {},
      status(code) { state.statusCode = code; return this; },
      json(body) { state.body = body; return this; }
    }
  };
};

test('Research public challenge handler never exposes database infrastructure errors', async () => {
  const secret = 'E407_DATABASE_SECRET';
  const handlers = createResearchPublicHandlers({
    getPool: () => ({
      async query() {
        throw new Error(`connect ECONNREFUSED postgresql://research:${secret}@db.internal/research`);
      }
    })
  });
  const out = responseRecorder();
  await handlers.issueChallenge({ body: {} }, out.res);
  assert.equal(out.state.statusCode, 400);
  assert.deepEqual(out.state.body, { error: 'Invalid Research request' });
  assert.equal(JSON.stringify(out.state).includes(secret), false);
  assert.equal(JSON.stringify(out.state).includes('db.internal'), false);
});

test('Research public aggregate handler keeps infrastructure failures behind the same public contract', async () => {
  const handlers = createResearchPublicHandlers({
    getPool: () => ({
      async query() { throw new Error('database host=db.internal credential=hidden'); }
    }),
    aggregateMinimumCellSize: 10
  });
  const out = responseRecorder();
  await handlers.readAnswerAggregates({ body: { questionId: 'q1' } }, out.res);
  assert.equal(out.state.statusCode, 400);
  assert.deepEqual(out.state.body, { error: 'Invalid Research request' });
});
