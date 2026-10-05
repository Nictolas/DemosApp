const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const app = require('../research-app');
const {
  RESEARCH_PUBLIC_MAX_BODY_BYTES
} = require('../config/researchPublicRequestPolicy');
const {
  createResearchPublicExposurePolicy
} = require('../config/researchPublicExposurePolicy');

const request = (body) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/v1/not-mounted',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => server.close(() => resolve({
        status: res.statusCode,
        body: responseBody,
        headers: res.headers
      })));
    });
    req.on('error', (error) => server.close(() => reject(error)));
    req.end(body);
  });
});

test('Research request body limit is one shared explicit policy constant', () => {
  assert.equal(RESEARCH_PUBLIC_MAX_BODY_BYTES, 64 * 1024);
  const policy = createResearchPublicExposurePolicy({
    shadowEnabled: true,
    publicApiEnabled: true,
    allowedOrigins: ['https://app.example']
  });
  assert.equal(policy.maxBodyBytes, RESEARCH_PUBLIC_MAX_BODY_BYTES);

  const source = fs.readFileSync(path.join(__dirname, '..', 'research-app.js'), 'utf8');
  assert.match(source, /limit:\s*RESEARCH_PUBLIC_MAX_BODY_BYTES/);
  assert.doesNotMatch(source, /limit:\s*['"]64kb['"]/i);
});

test('malformed JSON fails closed with minimal privacy-safe response headers', async () => {
  const response = await request('{"broken":');

  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'Invalid Research request' });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('oversized JSON is rejected before any Research route with no internal detail', async () => {
  const body = JSON.stringify({ payload: 'x'.repeat(RESEARCH_PUBLIC_MAX_BODY_BYTES) });
  assert.ok(Buffer.byteLength(body, 'utf8') > RESEARCH_PUBLIC_MAX_BODY_BYTES);

  const response = await request(body);

  assert.equal(response.status, 413);
  assert.deepEqual(JSON.parse(response.body), { error: 'Invalid Research request' });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.body.includes('entity.too.large'), false);
  assert.equal(response.body.includes('PayloadTooLargeError'), false);
});
