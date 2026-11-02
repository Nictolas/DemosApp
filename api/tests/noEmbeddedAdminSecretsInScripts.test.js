'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

// Scan every script, not just the twelve already retired entrypoints.
// Reports contain file paths and rule names only, never secret values.
const root = path.resolve(__dirname, '../../scripts');
const sourceExt = new Set(['.js', '.cjs', '.mjs', '.ts', '.ps1', '.sh']);

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.isFile() && sourceExt.has(path.extname(entry.name)) ? [full] : [];
  });
}

const rules = [
  {
    name: 'hardcoded Admin email/password variables',
    re: /\b(?:const|let|var)\s+ADMIN_(?:EMAIL|PASSWORD)\s*=\s*['"\x60]/i
  },
  {
    name: 'hardcoded Admin password or token property',
    re: /\bADMIN_(?:PASSWORD|TOKEN)\s*:\s*['"\x60]/i
  },
  {
    name: 'embedded Axiom API token',
    re: /\bxaat-[A-Za-z0-9_-]{20,}/
  },
  {
    name: 'logging an access token',
    re: /\bconsole\.(?:log|info|warn|error)\s*\([^;\n]*(?:tokens\.accessToken|accessToken)\b/
  },
  {
    name: 'interpolating access token into printed bearer header',
    re: /\bconsole\.(?:log|info|warn|error)\s*\([^;\n]*Bearer\s+\$\{[^}\n]*(?:accessToken|ADMIN_TOKEN)/
  }
];

test('the scanner recognizes fake embedded credential fixtures', () => {
  const fake = "const ADMIN_PASSWORD = 'placeholder-for-test-only';";
  assert.equal(rules[0].re.test(fake), true);
  assert.equal(rules[2].re.test('xaat-' + 'x'.repeat(24)), true);
  assert.equal(rules[3].re.test('console.log(tokens.accessToken);'), true);
});

test('all maintenance scripts avoid hardcoded Admin credentials and token output', () => {
  const files = collect(root);
  assert.ok(files.length >= 12, 'scripts directory unexpectedly small');
  for (const filename of files) {
    const source = readFileSync(filename, 'utf8');
    const relative = path.relative(root, filename);
    for (const { name, re } of rules) {
      assert.doesNotMatch(source, re, relative + ': ' + name);
    }
  }
});
