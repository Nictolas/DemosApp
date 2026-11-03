'use strict';

/**
 * Zero-network check for the public Google Play APP SIGNING certificate.
 *
 * Obtain the public .der/.pem certificate from Play Console -> App integrity
 * -> APP SIGNING KEY CERTIFICATE, NEVER the "Upload key certificate".
 * Read the registered SHA-256 fingerprint from Firebase Console -> App Check
 * -> DEMOS Android -> Play Integrity provider settings.
 *
 * Run:
 * node api/scripts/comparePlayAppSigningFingerprint.cjs
 *   --play-app-signing-cert <public-certificate.der>
 *   --firebase-sha256 <fingerprint-from-Firebase>
 *
 * Exit 0 = match, 1 = mismatch, 2 = missing/invalid evidence.
 * Only local file reads; no Google calls, credentials, signing/private keys,
 * cloud resources, writes or quota consumption.
 */
const fs = require('node:fs');
const { X509Certificate } = require('node:crypto');
const path = require('node:path');

function normalizeSha256(value) {
  if (typeof value !== 'string') throw new TypeError('SHA-256 mancante');
  const clean = value.replace(/[\s:]/g, '').toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(clean)) {
    throw new TypeError('SHA-256 non valida (richiesti 64 caratteri esadecimali)');
  }
  return clean;
}

function fingerprintOfPublicCertificate(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('Certificato pubblico Google Play mancante');
  }
  const extension = path.extname(filePath).toLowerCase();
  if (!['.der', '.cer', '.crt', '.pem'].includes(extension)) {
    throw new TypeError('Specificare solo un certificato pubblico .der/.cer/.crt/.pem, mai .jks');
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size < 100 || stats.size > 65536) {
    throw new TypeError('File del certificato pubblico non valido');
  }
  const cert = new X509Certificate(fs.readFileSync(filePath));
  return normalizeSha256(cert.fingerprint256);
}

function comparePlayAndFirebase({ playCertPath, firebaseSha256 }) {
  const playSha256 = fingerprintOfPublicCertificate(playCertPath);
  const registeredSha256 = normalizeSha256(firebaseSha256);
  return {
    playSha256,
    registeredSha256,
    matches: playSha256 === registeredSha256,
  };
}

function main(argv = process.argv.slice(2), io = console) {
  try {
    if (argv.length !== 4
      || argv[0] !== '--play-app-signing-cert'
      || argv[2] !== '--firebase-sha256') {
      io.error('Uso: node comparePlayAppSigningFingerprint.cjs --play-app-signing-cert <cert.der> --firebase-sha256 <SHA-256 Firebase App Check>');
      return 2;
    }
    const result = comparePlayAndFirebase({
      playCertPath: argv[1],
      firebaseSha256: argv[3],
    });
    io.log('SHA-256 certificato Play App Signing:', result.playSha256);
    io.log('SHA-256 registrata su Firebase App Check:', result.registeredSha256);
    io.log(result.matches ? 'CORRISPONDENZA CONFERMATA' : 'NON CORRISPONDONO: NON ATTIVARE APP CHECK');
    return result.matches ? 0 : 1;
  } catch (error) {
    io.error('Confronto non eseguito: ' + (error.code === 'ENOENT'
      ? 'file del certificato non trovato'
      : error instanceof TypeError ? error.message : 'certificato non valido'));
    return 2;
  }
}

module.exports = {
  normalizeSha256,
  fingerprintOfPublicCertificate,
  comparePlayAndFirebase,
  main,
};
if (require.main === module) {
  process.exitCode = main();
}
