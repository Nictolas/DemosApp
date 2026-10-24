const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEvidenceUrl } = require('../utils/recognitionEvidence');

test('allows public HTTPS institutional URLs and PDF sources', () => {
  assert.equal(validateEvidenceUrl('https://www.comune.pisa.it/elezioni/lista.pdf'),
    'https://www.comune.pisa.it/elezioni/lista.pdf');
  assert.equal(validateEvidenceUrl(' https://www.regione.toscana.it/elezioni '),
    'https://www.regione.toscana.it/elezioni');
});

test('rejects non-HTTPS, local, private-IP, credentials, and malformed URLs', () => {
  for (const url of [
    '', 'http://www.comune.pisa.it', 'file:///etc/passwd',
    'https://localhost/x', 'https://server.local/x',
    'https://127.0.0.1/path', 'https://192.168.1.1/path',
    'https://[::1]/', 'https://alice:password@www.comune.pisa.it/',
    'not an URL', 'https://localhost.evil.local/'
  ]) {
    assert.equal(validateEvidenceUrl(url), null, url);
  }
  assert.equal(validateEvidenceUrl('https://www.comune.pisa.it/' + 'a'.repeat(2050)), null);
});
