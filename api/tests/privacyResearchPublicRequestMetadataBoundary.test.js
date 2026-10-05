const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_PUBLIC_ROUTE_PREFIX,
  RESEARCH_PUBLIC_JSON_MEDIA_TYPE,
  FORBIDDEN_RESEARCH_PUBLIC_HEADERS
} = require('../config/researchPublicRequestPolicy');
const {
  RESEARCH_PUBLIC_ENDPOINTS
} = require('../services/researchPublicApiContract');
const {
  createResearchPublicBoundaryMiddleware
} = require('../middleware/researchPublicBoundary');

const policy = Object.freeze({
  allowedOrigins: Object.freeze(['https://app.example']),
  cacheControl: 'no-store'
});

const responseRecorder = () => {
  const state = { headers: {}, statusCode: null, body: null, ended: false };
  return {
    state,
    res: {
      setHeader(name, value) { state.headers[name] = value; },
      status(code) { state.statusCode = code; return this; },
      json(body) { state.body = body; return this; },
      end() { state.ended = true; return this; }
    }
  };
};

const request = ({
  method = 'POST',
  path = '/v1/proof-challenges',
  originalUrl = path,
  headers = {}
} = {}) => {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    method,
    path,
    originalUrl,
    query: {},
    headers: normalized,
    get(name) { return normalized[String(name).toLowerCase()]; }
  };
};

const run = (req) => {
  const out = responseRecorder();
  let nextCalls = 0;
  createResearchPublicBoundaryMiddleware({ policy })(req, out.res, () => { nextCalls += 1; });
  return { ...out, nextCalls };
};

test('Research public request policy centralizes route prefix and JSON media type', () => {
  assert.equal(RESEARCH_PUBLIC_ROUTE_PREFIX, '/v1');
  assert.equal(RESEARCH_PUBLIC_JSON_MEDIA_TYPE, 'application/json');
  for (const endpoint of Object.values(RESEARCH_PUBLIC_ENDPOINTS)) {
    assert.equal(endpoint.method, 'POST');
    assert.equal(endpoint.path.startsWith(RESEARCH_PUBLIC_ROUTE_PREFIX + '/'), true);
  }
});

test('Research public POST requires JSON while allowing an explicit charset parameter', () => {
  const missing = run(request());
  assert.equal(missing.nextCalls, 0);
  assert.equal(missing.state.statusCode, 415);
  assert.deepEqual(missing.state.body, { error: 'Invalid Research request' });

  const wrong = run(request({ headers: { 'Content-Type': 'text/plain' } }));
  assert.equal(wrong.nextCalls, 0);
  assert.equal(wrong.state.statusCode, 415);

  const accepted = run(request({
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }));
  assert.equal(accepted.nextCalls, 1);
  assert.equal(accepted.state.statusCode, null);
});

test('Research public API rejects ambient Identity/session headers before routing', () => {
  for (const header of FORBIDDEN_RESEARCH_PUBLIC_HEADERS) {
    const result = run(request({
      headers: {
        'Content-Type': 'application/json',
        [header]: 'identity-link'
      }
    }));
    assert.equal(result.nextCalls, 0, header);
    assert.equal(result.state.statusCode, 400, header);
    assert.deepEqual(result.state.body, { error: 'Invalid Research request' }, header);
  }
});

test('Research public API rejects query strings so sensitive inputs cannot drift into URLs', () => {
  const result = run(request({
    originalUrl: '/v1/proof-challenges?userId=identity-link',
    headers: { 'Content-Type': 'application/json' }
  }));
  assert.equal(result.nextCalls, 0);
  assert.equal(result.state.statusCode, 400);
  assert.deepEqual(result.state.body, { error: 'Invalid Research request' });
});

test('request metadata rules are scoped to /v1 and do not break the health endpoint', () => {
  const result = run(request({
    method: 'GET',
    path: '/health',
    originalUrl: '/health',
    headers: { Authorization: 'Bearer diagnostic-probe' }
  }));
  assert.equal(result.nextCalls, 1);
  assert.equal(result.state.statusCode, null);
});


test('non-CORS OPTIONS outside the public API is not swallowed by the Research boundary', () => {
  const result = run(request({
    method: 'OPTIONS',
    path: '/health',
    originalUrl: '/health'
  }));
  assert.equal(result.nextCalls, 1);
  assert.equal(result.state.statusCode, null);
});
