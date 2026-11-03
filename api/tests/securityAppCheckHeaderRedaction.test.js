'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const securitySource = fs.readFileSync(
  path.resolve(__dirname, '../middleware/security.js'),
  'utf8',
);

function loadProductionRedactor() {
  const captured = [];
  const messages = ['log', 'info', 'warn', 'error', 'debug'];
  const mockConsole = Object.fromEntries(messages.map(method => [
    method,
    (...args) => captured.push({ method, args }),
  ]));
  const sandbox = {
    module: { exports: {} },
    process: { env: { NODE_ENV: 'production' } },
    console: mockConsole,
    require: id => {
      if (id === 'express-rate-limit') {
        return options => options; // No network or server: pure offline test.
      }
      throw new Error('Unexpected dependency in security middleware: ' + id);
    },
  };
  vm.runInNewContext(securitySource, sandbox, { filename: 'security.js' });
  return {
    captured,
    console: sandbox.console,
    redact: sandbox.module.exports._test.redactForLogs,
  };
}

test('production console redacts X-Firebase-AppCheck even for opaque non-JWT values', () => {
  const runtime = loadProductionRedactor();
  runtime.console.log({
    headers: {
      'X-Firebase-AppCheck': 'sensitive-opaque-token-ABC',
      'x-firebase-appcheck': 'another-sensitive-value',
      'X-Requested-With': 'XMLHttpRequest',
    },
    attestation: 'opaque-attestation-XYZ',
  });
  assert.equal(runtime.captured.length, 1);
  const logged = JSON.stringify(runtime.captured[0].args);
  assert.equal(logged.includes('sensitive-opaque-token-ABC'), false);
  assert.equal(logged.includes('another-sensitive-value'), false);
  assert.equal(logged.includes('opaque-attestation-XYZ'), false);
  assert.equal(logged.includes('[REDACTED]'), true);
  assert.equal(logged.includes('XMLHttpRequest'), true);
});

test('direct production log sanitizer covers alternate app-check key variants', () => {
  const runtime = loadProductionRedactor();
  const values = runtime.redact({
    appCheck: 'token-one',
    app_check: 'token-two',
    'x-firebase-appcheck': 'token-three',
    'X-Firebase-AppCheck': 'token-four',
    nested: { AppCheckToken: 'token-five', publicStatus: 'disabled' },
  });
  const output = JSON.stringify(values);
  for (const value of ['token-one', 'token-two', 'token-three', 'token-four', 'token-five']) {
    assert.equal(output.includes(value), false);
  }
  assert.ok(output.includes('disabled'));
});
