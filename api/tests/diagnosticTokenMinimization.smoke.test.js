'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const scripts = [
  'scripts/verifica-token-axiom.js',
  'scripts/verify-axiom-data.js',
  'scripts/check-axiom-simple-query.js',
  'scripts/test-token-ingest-direct.js',
  'scripts/test-axiom-token.js',
  'scripts/test-axiom-sdk-stats.js',
  'scripts/test-axiom-direct-curl.js',
  'scripts/test-axiom-varianti.js',
  'scripts/test-apl-query.js',
  'scripts/test-dataset-api.js'
];

test('all Axiom diagnostic tools only print a boolean credential-configuration state', () => {
  for (const relativePath of scripts) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.match(source, /console\.log\('Token Axiom configurato:', Boolean\((?:token|process\.env\.AXIOM_API_TOKEN)\)\);/, relativePath);
    assert.doesNotMatch(source, /console\.log\([^\n]*(?:token|AXIOM_API_TOKEN)\.(?:substring|substr|slice)\(/i, relativePath);
  }
});

test('browser FCM diagnostic message never prints the registration token', () => {
  const source = fs.readFileSync(path.join(root, 'client/src/hooks/useFCM.ts'), 'utf8');
  assert.match(source, /Token FCM ottenuto correttamente/);
  assert.doesNotMatch(source, /console\.(?:log|debug|info)\([^\n]*(?:currentToken|fcmToken)\.(?:substring|substr|slice)\(/);
});
