const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('isolated Privacy Pass POC stays pinned and outside production API dependencies', () => {
  const apiPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const pocPackage = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'experiments', 'privacy-pass-poc', 'package.json'),
    'utf8'
  ));

  assert.equal(apiPackage.dependencies?.['@cloudflare/privacypass-ts'], undefined);
  assert.equal(pocPackage.dependencies?.['@cloudflare/privacypass-ts'], '0.9.0');
});

test('Research Privacy Pass verifier contains no issuer or private-key capability', () => {
  const providerSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchPrivacyPassCredentialProvider.js'),
    'utf8'
  );
  const integrationSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'experiments', 'privacy-pass-poc', 'demos-research-verifier-integration.test.mjs'),
    'utf8'
  );

  assert.doesNotMatch(providerSource, /\bIssuer\b|privateKey|blindSign|\.issue\s*\(/);
  assert.match(providerSource, /Token\.deserialize/);
  assert.match(providerSource, /origin\.verify/);
  assert.match(integrationSource, /createResearchPrivacyPassCredentialProvider/);
});
