const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeFiscalNumber,
  derivePersonKey
} = require('../services/identityVerificationService');

const SECRET = 'test-secret-for-demos-identity-key-1234567890';

test('normalizza fiscal_number CIE con prefisso TINIT-', () => {
  assert.equal(
    normalizeFiscalNumber('TINIT-abcdef12g34h567i'),
    'ABCDEF12G34H567I'
  );
});

test('normalizza spazi e maiuscole senza alterare il contenuto', () => {
  assert.equal(
    normalizeFiscalNumber('  ABCDEF12G34H567I  '),
    'ABCDEF12G34H567I'
  );
});

test('stessa persona produce la stessa person_key con o senza prefisso CIE', () => {
  const a = derivePersonKey('TINIT-ABCDEF12G34H567I', SECRET);
  const b = derivePersonKey('abcdef12g34h567i', SECRET);

  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test('codici fiscali diversi producono person_key diverse', () => {
  const a = derivePersonKey('ABCDEF12G34H567I', SECRET);
  const b = derivePersonKey('ABCDEF12G34H568J', SECRET);

  assert.notEqual(a, b);
});

test('rifiuta fiscal_number formalmente non valido', () => {
  assert.throws(
    () => normalizeFiscalNumber('TINIT-ABC123'),
    /non valido/
  );
});

test('rifiuta segreti HMAC mancanti o troppo corti', () => {
  const oldSecret = process.env.IDENTITY_HMAC_SECRET;
  delete process.env.IDENTITY_HMAC_SECRET;

  try {
    assert.throws(
      () => derivePersonKey('ABCDEF12G34H567I'),
      /non configurato/
    );

    assert.throws(
      () => derivePersonKey('ABCDEF12G34H567I', 'troppo-corto'),
      /almeno 32 byte/
    );
  } finally {
    if (oldSecret === undefined) {
      delete process.env.IDENTITY_HMAC_SECRET;
    } else {
      process.env.IDENTITY_HMAC_SECRET = oldSecret;
    }
  }
});
