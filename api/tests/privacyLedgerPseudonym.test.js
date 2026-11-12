const test = require('node:test');
const assert = require('node:assert/strict');
const {
  derivePrivacyLedgerSubjectKey,
  getPrivacyLedgerHmacSecret,
  normalizePrivacyLedgerKeyVersion,
  normalizePrivacyLedgerSubjectId
} = require('../utils/privacyLedgerPseudonym');

const SECRET = 'test-privacy-ledger-secret-32-bytes-minimum-value';

test('normalizza subject id e key version', () => {
  assert.equal(normalizePrivacyLedgerSubjectId(' 123 '), '123');
  assert.equal(normalizePrivacyLedgerKeyVersion(), 'v1');
  assert.equal(normalizePrivacyLedgerKeyVersion('v2'), 'v2');
  assert.throws(() => normalizePrivacyLedgerSubjectId('   '), /vuoto/);
  assert.throws(() => normalizePrivacyLedgerKeyVersion('v 2'), /non valida/);
});

test('rifiuta segreto HMAC mancante o troppo corto', () => {
  const previous = process.env.PRIVACY_LEDGER_HMAC_SECRET;
  delete process.env.PRIVACY_LEDGER_HMAC_SECRET;
  try {
    assert.throws(() => getPrivacyLedgerHmacSecret(), /non configurato/);
    assert.throws(() => getPrivacyLedgerHmacSecret('short'), /almeno 32 byte/);
  } finally {
    if (previous === undefined) delete process.env.PRIVACY_LEDGER_HMAC_SECRET;
    else process.env.PRIVACY_LEDGER_HMAC_SECRET = previous;
  }
});

test('deriva pseudonimo deterministico e non espone subject id', () => {
  const first = derivePrivacyLedgerSubjectKey('user-123', { secret: SECRET, version: 'v1' });
  const second = derivePrivacyLedgerSubjectKey('user-123', { secret: SECRET, version: 'v1' });

  assert.equal(first, second);
  assert.match(first, /^v1:[a-f0-9]{64}$/);
  assert.equal(first.includes('user-123'), false);
});

test('versioni e subject differenti producono chiavi differenti', () => {
  const v1 = derivePrivacyLedgerSubjectKey('user-123', { secret: SECRET, version: 'v1' });
  const v2 = derivePrivacyLedgerSubjectKey('user-123', { secret: SECRET, version: 'v2' });
  const other = derivePrivacyLedgerSubjectKey('user-456', { secret: SECRET, version: 'v1' });

  assert.notEqual(v1, v2);
  assert.notEqual(v1, other);
});

test('usa PRIVACY_LEDGER_HMAC_SECRET solo quando non viene passato un segreto esplicito', () => {
  const previous = process.env.PRIVACY_LEDGER_HMAC_SECRET;
  process.env.PRIVACY_LEDGER_HMAC_SECRET = SECRET;
  try {
    const fromEnv = derivePrivacyLedgerSubjectKey('user-123');
    const explicit = derivePrivacyLedgerSubjectKey('user-123', { secret: SECRET });
    assert.equal(fromEnv, explicit);
  } finally {
    if (previous === undefined) delete process.env.PRIVACY_LEDGER_HMAC_SECRET;
    else process.env.PRIVACY_LEDGER_HMAC_SECRET = previous;
  }
});
