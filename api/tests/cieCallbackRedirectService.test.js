const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTrustedFrontendBaseUrl,
  buildCieCallbackRedirect
} = require('../services/cieCallbackRedirectService');

test.beforeEach(() => {
  process.env.FRONTEND_URL = 'https://www.demos.community';
});

test('costruisce redirect success senza dati personali', () => {
  assert.equal(
    buildCieCallbackRedirect('success'),
    'https://www.demos.community/impostazioni?cie=success'
  );
});

test('costruisce redirect error generico', () => {
  assert.equal(
    buildCieCallbackRedirect('error'),
    'https://www.demos.community/impostazioni?cie=error'
  );
});

test('rifiuta esiti arbitrari', () => {
  assert.throws(
    () => buildCieCallbackRedirect('RSSMRA80A01H501U'),
    /Esito callback CIE non valido/
  );
});

test('rifiuta frontend non HTTPS', () => {
  process.env.FRONTEND_URL = 'http://example.test';
  assert.throws(
    () => getTrustedFrontendBaseUrl(),
    /HTTPS/
  );
});
