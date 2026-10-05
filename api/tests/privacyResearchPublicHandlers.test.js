const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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

test('unmounted Research challenge handler accepts no Identity payload and returns no expiry metadata', async () => {
  const pool = {
    async query(sql) {
      assert.match(sql, /INSERT INTO research\.proof_challenges/i);
      return { rows: [] };
    }
  };
  const handlers = createResearchPublicHandlers({ getPool: () => pool });

  const ok = responseRecorder();
  await handlers.issueChallenge({ body: {} }, ok.res);
  assert.equal(ok.state.statusCode, 201);
  assert.equal(typeof ok.state.body.challenge, 'string');
  assert.equal(ok.state.body.purpose, 'read-opinions-v1');
  assert.deepEqual(Object.keys(ok.state.body).sort(), ['challenge', 'purpose']);

  const rejected = responseRecorder();
  await handlers.issueChallenge({ body: { userId: 'identity-link' } }, rejected.res);
  assert.equal(rejected.state.statusCode, 400);
});

test('unmounted Research read handler rejects Identity fields before any database query', async () => {
  let queryCalls = 0;
  const handlers = createResearchPublicHandlers({
    getPool: () => ({
      async query() {
        queryCalls += 1;
        return { rows: [] };
      }
    })
  });
  const out = responseRecorder();

  await handlers.readOpinionVector({
    body: {
      participantPublicKey: crypto.randomBytes(32).toString('base64url'),
      challenge: crypto.randomBytes(32).toString('base64url'),
      signature: crypto.randomBytes(64).toString('base64url'),
      email: 'identity@example.invalid'
    }
  }, out.res);

  assert.equal(out.state.statusCode, 400);
  assert.equal(queryCalls, 0);
  assert.deepEqual(out.state.body, { error: 'Invalid Research request' });
});
