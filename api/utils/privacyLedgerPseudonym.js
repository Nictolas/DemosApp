const crypto = require('crypto');

const PRIVACY_LEDGER_DOMAIN = 'demos-privacy-ledger-subject:';
const DEFAULT_PRIVACY_LEDGER_KEY_VERSION = 'v1';
const MIN_PRIVACY_LEDGER_SECRET_BYTES = 32;

function normalizePrivacyLedgerSubjectId(value) {
  if (value == null) throw new Error('privacy ledger subject id mancante');
  const normalized = String(value).trim();
  if (!normalized) throw new Error('privacy ledger subject id vuoto');
  return normalized;
}

function normalizePrivacyLedgerKeyVersion(value = DEFAULT_PRIVACY_LEDGER_KEY_VERSION) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(normalized)) {
    throw new Error('privacy ledger key version non valida');
  }
  return normalized;
}

function getPrivacyLedgerHmacSecret(explicitSecret) {
  const secret = explicitSecret || process.env.PRIVACY_LEDGER_HMAC_SECRET;
  if (!secret) throw new Error('PRIVACY_LEDGER_HMAC_SECRET non configurato');
  if (Buffer.byteLength(secret, 'utf8') < MIN_PRIVACY_LEDGER_SECRET_BYTES) {
    throw new Error(`PRIVACY_LEDGER_HMAC_SECRET deve essere lungo almeno ${MIN_PRIVACY_LEDGER_SECRET_BYTES} byte`);
  }
  return secret;
}

function derivePrivacyLedgerSubjectKey(subjectUserId, { secret, version } = {}) {
  const normalizedSubject = normalizePrivacyLedgerSubjectId(subjectUserId);
  const normalizedVersion = normalizePrivacyLedgerKeyVersion(version);
  const hmacSecret = getPrivacyLedgerHmacSecret(secret);
  const digest = crypto
    .createHmac('sha256', hmacSecret)
    .update(`${PRIVACY_LEDGER_DOMAIN}${normalizedVersion}:${normalizedSubject}`, 'utf8')
    .digest('hex');

  return `${normalizedVersion}:${digest}`;
}

module.exports = {
  PRIVACY_LEDGER_DOMAIN,
  DEFAULT_PRIVACY_LEDGER_KEY_VERSION,
  MIN_PRIVACY_LEDGER_SECRET_BYTES,
  normalizePrivacyLedgerSubjectId,
  normalizePrivacyLedgerKeyVersion,
  getPrivacyLedgerHmacSecret,
  derivePrivacyLedgerSubjectKey
};
