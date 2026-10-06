const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const app = require('../research-app');
const manifest = require('../config/researchRuntimeSastManifest');

const request = ({ requestPath, method = 'GET', headers = {}, body = '' }) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: requestPath,
      method,
      headers
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

const assertPublicSafetyHeaders = (headers) => {
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.equal(headers['x-robots-tag'], 'noindex, nofollow, noarchive');
  assert.equal(headers['x-powered-by'], undefined);
  assert.equal(headers.etag, undefined);
};

test('Research health endpoint exposes only constant liveness', async () => {
  const response = await request({ requestPath: '/health' });

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { success: true });
  assert.deepEqual(Object.keys(JSON.parse(response.body)), ['success']);
  assert.ok(Buffer.byteLength(response.body, 'utf8') <= 32);
  assertPublicSafetyHeaders(response.headers);

  for (const forbidden of [
    'demos-research-shadow', 'mode', 'enabled', 'publicApiMounted',
    'blockers', 'productionApprovalRecorded', 'researchDatabaseConfigured'
  ]) {
    assert.equal(response.body.includes(forbidden), false, forbidden);
  }
});

test('unknown Research routes use one generic non-enumerating 404 body', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await request({ requestPath: '/definitely-not-a-route', method });
    assert.equal(response.status, 404);
    assert.deepEqual(JSON.parse(response.body), { error: 'Invalid Research request' });
    assert.equal(response.body.includes('Route not found'), false);
    assert.equal(response.body.includes('/definitely-not-a-route'), false);
    assertPublicSafetyHeaders(response.headers);
  }
});

test('standalone Research runtime no longer imports shadow configuration just to answer health', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'research-app.js'), 'utf8');
  assert.equal(source.includes('privacyResearchShadow'), false);
  assert.equal(manifest.includes('api/config/privacyResearchShadow.js'), false);
  assert.match(source, /app\.disable\(['"]x-powered-by['"]\)/);
  assert.match(source, /app\.disable\(['"]etag['"]\)/);
});
