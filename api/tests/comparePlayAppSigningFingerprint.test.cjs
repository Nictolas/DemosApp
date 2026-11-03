'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { X509Certificate } = require('node:crypto');
const { rootCertificates } = require('node:tls');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  normalizeSha256,
  fingerprintOfPublicCertificate,
  comparePlayAndFirebase,
  main,
} = require('../scripts/comparePlayAppSigningFingerprint.cjs');

// Public CA certificate is test-only fixture: never mistaken for DEMOS Play signing.
function withPublicCertificate(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'demos-public-cert-check-'));
  try {
    const pem = rootCertificates[0];
    const file = path.join(dir, 'fixture.pem');
    writeFileSync(file, pem);
    const expected = new X509Certificate(pem).fingerprint256.replace(/:/g, '');
    return fn({ file, pem, expected });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('normalizes strict SHA-256 with or without colons', () => {
  const value = 'aB'.repeat(32);
  assert.equal(normalizeSha256(value), 'AB'.repeat(32));
  assert.equal(normalizeSha256('ab:'.repeat(31) + 'ab'), 'AB'.repeat(32));
  for (const invalid of [null, '', 'a', 'f'.repeat(63), 'f'.repeat(65), 'x'.repeat(64)]) {
    assert.throws(() => normalizeSha256(invalid));
  }
});

test('reads a public certificate locally and matches only identical SHA-256', () => {
  withPublicCertificate(({ file, expected }) => {
    assert.equal(fingerprintOfPublicCertificate(file), expected);
    assert.equal(comparePlayAndFirebase({ playCertPath: file, firebaseSha256: expected }).matches, true);
    assert.equal(comparePlayAndFirebase({ playCertPath: file, firebaseSha256: '0'.repeat(64) }).matches, false);
  });
});

test('does not accept private keystores or nonexistent public certificates', () => {
  withPublicCertificate(({ file, pem }) => {
    const badPath = file.replace('.pem', '.jks');
    writeFileSync(badPath, pem);
    assert.throws(() => fingerprintOfPublicCertificate(badPath));
    assert.throws(() => fingerprintOfPublicCertificate(file + '.missing'));
  });
});

test('command has explicit success, mismatch and insufficient-evidence exit codes', () => {
  withPublicCertificate(({ file, expected }) => {
    const lines = [];
    const io = { log: (...v) => lines.push(v.join(' ')), error: (...v) => lines.push(v.join(' ')) };
    assert.equal(main(['--play-app-signing-cert', file, '--firebase-sha256', expected], io), 0);
    assert.ok(lines.some(l => l.includes('CORRISPONDENZA CONFERMATA')));
    assert.equal(main(['--play-app-signing-cert', file, '--firebase-sha256', '0'.repeat(64)], io), 1);
    assert.ok(lines.some(l => l.includes('NON CORRISPONDONO')));
    assert.equal(main(['--play-app-signing-cert', file, '--firebase-sha256', 'invalid'], io), 2);
    assert.equal(main([], io), 2);
  });
});

test('offline verifier contains no Google services, auth, network or secret access', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../scripts/comparePlayAppSigningFingerprint.cjs'), 'utf8'
  );
  assert.doesNotMatch(source, /require\(['"](?:https?|axios|firebase-admin|google-auth-library|child_process)['"]\)/);
  assert.doesNotMatch(source, /fetch\(|process\.env\.|private_key|FIREBASE_PRIVATE_KEY/);
  assert.match(source, /--play-app-signing-cert/);
  assert.match(source, /--firebase-sha256/);
});
