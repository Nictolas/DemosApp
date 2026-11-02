'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const authDir = path.resolve(__dirname, '../routes/auth');
const index = readFileSync(path.join(authDir, 'index.js'), 'utf8');
const appSource = readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

test('active auth composition keeps OAuth and WebAuthn without password-login modules', () => {
  const imports = [...index.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)]
    .map(match => match[1]);
  assert.ok(imports.includes('oauth'), 'Google/Apple OAuth should remain mounted');
  assert.ok(imports.includes('webauthn'), 'passkey login should remain mounted');
  assert.ok(imports.includes('logout'), 'logout should remain mounted');
  assert.ok(imports.includes('refresh'), 'refresh should remain mounted');
  assert.doesNotMatch(index, /require\(['"]\.\/(?:password|login|credentials|password-login)['"]\)/);
  assert.match(appSource, /app\.use\(['"]\/api\/auth['"],\s*authLimiter,\s*authRoutes\)/);

  for (const name of imports) {
    const source = readFileSync(path.join(authDir, name + '.js'), 'utf8');
    assert.doesNotMatch(
      source,
      /\b(?:router|app)\.(?:post|all|use|get|put|patch)\s*\(\s*['"]\/(?:auth\/)?login['"]/,
      name + ': unexpected generic password login route'
    );
    assert.doesNotMatch(
      source,
      /\bbcrypt\.compare\(\s*req\.body\.password/,
      name + ': unreviewed password-based login'
    );
  }
  assert.ok(imports.length >= 8, 'auth composition unexpectedly incomplete');
});

test('Express app does not register a separate legacy password login route', () => {
  assert.doesNotMatch(
    appSource,
    /\bapp\.(?:post|all|use)\s*\(\s*['"]\/(?:api\/)?auth\/login['"]/,
    'legacy password login route unexpectedly mounted'
  );
});
