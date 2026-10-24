const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTrustedFrontendBaseUrl,
  buildCieCallbackRedirect,
  buildRecognitionCieCallbackRedirect,
  buildRegistrationCieCallbackRedirect
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

test('costruisce redirect already-linked senza identificativi', () => {
  assert.equal(
    buildCieCallbackRedirect('already-linked'),
    'https://www.demos.community/impostazioni?cie=already-linked'
  );
});

test('costruisce redirect account-already-verified senza identificativi', () => {
  assert.equal(
    buildCieCallbackRedirect('account-already-verified'),
    'https://www.demos.community/impostazioni?cie=account-already-verified'
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


test('redirect registrazione mette il ticket one-time solo nel fragment', () => {
  const ticket = 'x'.repeat(43);
  const redirect = buildRegistrationCieCallbackRedirect('success', ticket);
  const url = new URL(redirect);

  assert.equal(url.pathname, '/registrazione-crea-passkey');
  assert.equal(url.search, '');
  assert.equal(url.hash, `#cie=success&ticket=${ticket}`);
});

test('redirect registrazione success rifiuta ticket mancante', () => {
  assert.throws(
    () => buildRegistrationCieCallbackRedirect('success'),
    /Ticket registrazione mancante/
  );
});

test('step-up CIE returns to recognition with no names in URL', () => {
  assert.equal(
    buildRecognitionCieCallbackRedirect('success'),
    'https://www.demos.community/riconoscimento?cie=success'
  );
  assert.equal(
    buildRecognitionCieCallbackRedirect('error'),
    'https://www.demos.community/riconoscimento?cie=error'
  );
  assert.throws(
    () => buildRecognitionCieCallbackRedirect('given-name'),
    /Esito riconoscimento CIE non valido/
  );
});
