const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  normalizeFailureDiagnostics,
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

test('Research handler diagnostics injection fails closed for missing or partial objects', () => {
  for (const candidate of [null, {}, { record: true }, { enabled: true }]) {
    const diagnostics = normalizeFailureDiagnostics(candidate);
    assert.doesNotThrow(() => diagnostics.record({ kind: 'request' }));
    assert.equal(typeof diagnostics.record, 'function');
  }
});

test('Research handler diagnostics wrapper isolates hostile injected record functions', async () => {
  let diagnosticCalls = 0;
  const handlers = createResearchPublicHandlers({
    getPool: () => { throw new Error('database unavailable'); },
    failureDiagnostics: {
      record() {
        diagnosticCalls += 1;
        throw new Error('hostile diagnostics');
      }
    }
  });
  const response = responseRecorder();
  await handlers.issueChallenge({ body: {} }, response.res);
  assert.equal(diagnosticCalls, 1);
  assert.equal(response.state.statusCode, 400);
  assert.deepEqual(response.state.body, { error: 'Invalid Research request' });
});

test('Research handler construction survives throwing diagnostics getters', async () => {
  const hostile = Object.defineProperty({}, 'record', {
    get() { throw new Error('getter side effect'); }
  });
  assert.doesNotThrow(() => createResearchPublicHandlers({ failureDiagnostics: hostile }));
});

test('Research handler construction survives throwing diagnostics proxies', () => {
  const hostile = new Proxy({}, {
    get() { throw new Error('proxy side effect'); }
  });
  assert.doesNotThrow(() => createResearchPublicHandlers({ failureDiagnostics: hostile }));
});

test('Research diagnostics callable is captured once during normalization', async () => {
  let getterReads = 0;
  let calls = 0;
  const candidate = Object.defineProperty({}, 'record', {
    get() {
      getterReads += 1;
      return () => { calls += 1; };
    }
  });
  const handlers = createResearchPublicHandlers({
    getPool: () => { throw new Error('database unavailable'); },
    failureDiagnostics: candidate
  });
  const response = responseRecorder();
  await handlers.issueChallenge({ body: {} }, response.res);
  assert.equal(getterReads, 1);
  assert.equal(calls, 1);
  assert.equal(response.state.statusCode, 400);
});
