const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_RESEARCH_PUBLIC_ORIGINS,
  normalizeAllowedOrigin,
  parseAllowedOrigins,
  createResearchPublicExposurePolicy
} = require('../config/researchPublicExposurePolicy');

test('Research public exposure requires two explicit flags and never enables credentialed CORS', () => {
  const off = createResearchPublicExposurePolicy({
    shadowEnabled: true,
    publicApiEnabled: false,
    allowedOrigins: ['https://app.example']
  });
  assert.equal(off.mountAllowed, false);
  assert.equal(off.allowCredentials, false);

  const on = createResearchPublicExposurePolicy({
    shadowEnabled: true,
    publicApiEnabled: true,
    allowedOrigins: ['https://app.example']
  });
  assert.equal(on.mountAllowed, true);
  assert.equal(on.allowCredentials, false);
  assert.deepEqual(on.errorBodyKeys, ['error']);
  assert.equal(on.maxBodyBytes, 65536);
  assert.equal(on.cacheControl, 'no-store');
});

test('Research origin policy canonicalizes an exact HTTPS origin allowlist', () => {
  assert.deepEqual(
    parseAllowedOrigins(' https://one.example/,https://two.example,https://one.example '),
    ['https://one.example', 'https://two.example']
  );
  assert.deepEqual(parseAllowedOrigins(''), []);
  assert.equal(normalizeAllowedOrigin('https://APP.example:443/'), 'https://app.example');
});

test('Research origin policy rejects wildcard, insecure and non-origin configuration', () => {
  for (const value of [
    '*',
    'null',
    'http://app.example',
    'javascript:alert(1)',
    'https://user:pass@app.example',
    'https://app.example/path',
    'https://app.example?debug=1',
    'https://app.example/#fragment'
  ]) {
    assert.throws(() => normalizeAllowedOrigin(value), /allowed origin/i, value);
  }
});

test('Research origin policy bounds the number of configured browser origins', () => {
  const origins = Array.from(
    { length: MAX_RESEARCH_PUBLIC_ORIGINS + 1 },
    (_, index) => `https://app-${index}.example`
  );
  assert.throws(
    () => createResearchPublicExposurePolicy({
      shadowEnabled: true,
      publicApiEnabled: true,
      allowedOrigins: origins
    }),
    /allowed origins/i
  );
});

test('Research app remains unmounted while exposure prerequisites are only policy', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'research-app.js'), 'utf8');
  assert.doesNotMatch(source, /researchPublicRouter|PRIVACY_RESEARCH_PUBLIC_API_ENABLED|researchPublicExposurePolicy/);
});
