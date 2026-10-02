const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
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

test('Research origin policy is allowlist-only and trims configuration', () => {
  assert.deepEqual(
    parseAllowedOrigins(' https://one.example,https://two.example ,,'),
    ['https://one.example', 'https://two.example']
  );
  assert.deepEqual(parseAllowedOrigins(''), []);
});

test('Research app remains unmounted while exposure prerequisites are only policy', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'research-app.js'), 'utf8');
  assert.doesNotMatch(source, /researchPublicRouter|PRIVACY_RESEARCH_PUBLIC_API_ENABLED|researchPublicExposurePolicy/);
});
