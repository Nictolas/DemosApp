const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  createResearchPublicIntegrationPoc
} = require('../researchPublicIntegrationPoc');

const request = (app, { method = 'POST', path = '/v1/proof-challenges', origin, headers = {} } = {}) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: { ...headers, ...(origin ? { Origin: origin } : {}) }
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => server.close(() => resolve({ status: res.statusCode, body, headers: res.headers })));
    });
    req.on('error', (error) => server.close(() => reject(error)));
    req.end();
  });
});

test('HTTP POC returns 404 when Research public exposure is disabled', async () => {
  const { app, mounted } = createResearchPublicIntegrationPoc({
    policy: { mountAllowed: false, allowedOrigins: ['https://app.example'] },
    boundary: (req, res, next) => next(),
    router: (req, res) => res.status(204).end(),
    errorHandler: (err, req, res, next) => next(err)
  });
  assert.equal(mounted, false);
  const response = await request(app);
  assert.equal(response.status, 404);
});

test('HTTP POC traverses boundary then router only when explicitly enabled', async () => {
  const calls = [];
  const { app, mounted } = createResearchPublicIntegrationPoc({
    policy: { mountAllowed: true, allowedOrigins: ['https://app.example'] },
    boundary: (req, res, next) => { calls.push('boundary'); next(); },
    router: (req, res) => { calls.push('router'); res.status(204).end(); },
    errorHandler: (err, req, res, next) => next(err)
  });
  assert.equal(mounted, true);
  const response = await request(app, { origin: 'https://app.example' });
  assert.equal(response.status, 204);
  assert.deepEqual(calls, ['boundary', 'router']);
});


test('HTTP POC rejects a foreign origin before the Research router observes identity-bearing headers', async () => {
  let routerCalls = 0;
  const { createResearchPublicBoundaryMiddleware } = require('../middleware/researchPublicBoundary');
  const policy = {
    mountAllowed: true,
    allowedOrigins: ['https://app.example'],
    cacheControl: 'no-store'
  };
  const { app, mounted } = createResearchPublicIntegrationPoc({
    policy,
    boundary: createResearchPublicBoundaryMiddleware({ policy }),
    router: (req, res) => {
      routerCalls += 1;
      res.status(204).end();
    },
    errorHandler: (err, req, res, next) => next(err)
  });

  assert.equal(mounted, true);
  const response = await request(app, {
    origin: 'https://evil.example',
    headers: {
      Authorization: 'Bearer identity-session-token',
      Cookie: 'session=identity-cookie'
    }
  });
  assert.equal(response.status, 403);
  assert.equal(routerCalls, 0);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.equal(response.headers['access-control-allow-credentials'], undefined);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
});

test('HTTP POC preflight exposes only the narrow Research browser contract', async () => {
  const { createResearchPublicBoundaryMiddleware } = require('../middleware/researchPublicBoundary');
  const policy = {
    mountAllowed: true,
    allowedOrigins: ['https://app.example'],
    cacheControl: 'no-store'
  };
  let routerCalls = 0;
  const { app } = createResearchPublicIntegrationPoc({
    policy,
    boundary: createResearchPublicBoundaryMiddleware({ policy }),
    router: (req, res) => {
      routerCalls += 1;
      res.status(204).end();
    },
    errorHandler: (err, req, res, next) => next(err)
  });
  const response = await request(app, {
    method: 'OPTIONS',
    origin: 'https://app.example',
    headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, cookie, content-type'
    }
  });

  assert.equal(response.status, 204);
  assert.equal(routerCalls, 0);
  assert.equal(response.headers['access-control-allow-origin'], 'https://app.example');
  assert.equal(response.headers['access-control-allow-credentials'], undefined);
  assert.equal(response.headers['access-control-allow-headers'], 'Content-Type');
  assert.equal(response.headers['access-control-allow-methods'], 'POST, OPTIONS');
});
