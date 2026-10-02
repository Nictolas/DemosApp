const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  createResearchPublicIntegrationPoc
} = require('../researchPublicIntegrationPoc');

const request = (app, { method = 'POST', path = '/v1/proof-challenges', origin } = {}) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: origin ? { Origin: origin } : {}
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
