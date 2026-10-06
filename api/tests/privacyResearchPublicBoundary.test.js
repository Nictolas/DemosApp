const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createResearchPublicBoundaryMiddleware,
  researchPublicErrorHandler
} = require('../middleware/researchPublicBoundary');

const responseRecorder = () => {
  const state = { headers: {}, statusCode: null, body: null, ended: false };
  return {
    state,
    res: {
      headersSent: false,
      setHeader(name, value) { state.headers[name] = value; },
      status(code) { state.statusCode = code; return this; },
      json(body) { state.body = body; return this; },
      end() { state.ended = true; return this; }
    }
  };
};

test('Research boundary allows only configured origins and never enables credentials', () => {
  const middleware = createResearchPublicBoundaryMiddleware({
    policy: {
      allowedOrigins: ['https://app.example'],
      cacheControl: 'no-store'
    }
  });

  const allowed = responseRecorder();
  let nextCalls = 0;
  middleware({ method: 'POST', get: (name) => name === 'Origin' ? 'https://app.example' : undefined }, allowed.res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(allowed.state.headers['Access-Control-Allow-Origin'], 'https://app.example');
  assert.equal(allowed.state.headers['Access-Control-Allow-Credentials'], undefined);
  assert.equal(allowed.state.headers['Cache-Control'], 'no-store');

  const denied = responseRecorder();
  middleware({ method: 'POST', get: () => 'https://evil.example' }, denied.res, () => assert.fail('denied origin reached next'));
  assert.equal(denied.state.statusCode, 403);
  assert.deepEqual(denied.state.body, { error: 'Invalid Research request' });
});

test('Research boundary handles preflight narrowly and error handler leaks no internals', () => {
  const middleware = createResearchPublicBoundaryMiddleware({
    policy: {
      allowedOrigins: ['https://app.example'],
      cacheControl: 'no-store'
    }
  });
  const preflight = responseRecorder();
  middleware({ method: 'OPTIONS', get: () => 'https://app.example' }, preflight.res, () => assert.fail('preflight reached next'));
  assert.equal(preflight.state.statusCode, 204);
  assert.equal(preflight.state.ended, true);
  assert.equal(preflight.state.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
  assert.equal(preflight.state.headers['Access-Control-Allow-Headers'], 'Content-Type');

  const failure = responseRecorder();
  researchPublicErrorHandler(new Error('sensitive database detail'), {}, failure.res, () => {});
  assert.equal(failure.state.statusCode, 400);
  assert.deepEqual(failure.state.body, { error: 'Invalid Research request' });
  assert.equal(JSON.stringify(failure.state.body).includes('database'), false);
});


test('Research boundary never opts into cookies, authorization headers or browser credential sharing', () => {
  const middleware = createResearchPublicBoundaryMiddleware({
    policy: {
      allowedOrigins: ['https://app.example'],
      cacheControl: 'no-store'
    }
  });
  const allowed = responseRecorder();
  middleware(
    { method: 'OPTIONS', get: () => 'https://app.example' },
    allowed.res,
    () => assert.fail('preflight reached next')
  );

  assert.equal(allowed.state.headers['Access-Control-Allow-Credentials'], undefined);
  assert.equal(allowed.state.headers['Access-Control-Allow-Headers'], 'Content-Type');
  assert.equal(
    String(allowed.state.headers['Access-Control-Allow-Headers']).toLowerCase().includes('authorization'),
    false
  );
  assert.equal(
    String(allowed.state.headers['Access-Control-Allow-Headers']).toLowerCase().includes('cookie'),
    false
  );
});

test('Research boundary applies privacy headers even when an origin is rejected', () => {
  const middleware = createResearchPublicBoundaryMiddleware({
    policy: {
      allowedOrigins: ['https://app.example'],
      cacheControl: 'no-store'
    }
  });
  const denied = responseRecorder();
  middleware(
    { method: 'POST', get: () => 'https://evil.example' },
    denied.res,
    () => assert.fail('denied origin reached next')
  );

  assert.equal(denied.state.statusCode, 403);
  assert.equal(denied.state.headers['Cache-Control'], 'no-store');
  assert.equal(denied.state.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(denied.state.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(denied.state.headers['Access-Control-Allow-Origin'], undefined);
});
