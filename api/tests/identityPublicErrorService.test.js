const test = require('node:test');
const assert = require('node:assert/strict');

const { IDENTITY_ERROR_CODES } = require('../constants/identityVerification');
const { getPublicIdentityError } = require('../services/identityPublicErrorService');

test('mappa account gia verificato su 409 con codice pubblico', () => {
  assert.deepEqual(
    getPublicIdentityError(
      { code: IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED },
      { status: 500, error: 'fallback' }
    ),
    {
      status: 409,
      code: IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED,
      error: 'Account gia associato a una identita verificata'
    }
  );
});

test('mappa verifica CIE gia in corso su 409 con codice pubblico', () => {
  assert.deepEqual(
    getPublicIdentityError(
      { code: IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE },
      { status: 500, error: 'fallback' }
    ),
    {
      status: 409,
      code: IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE,
      error: 'Verifica CIE gia in corso'
    }
  );
});

test('non espone codici interni dei conflitti identita', () => {
  const result = getPublicIdentityError(
    { code: IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED },
    { status: 500, error: 'fallback' }
  );

  assert.deepEqual(result, {
    status: 409,
    error: 'Identita gia associata a un altro account DEMOS'
  });
  assert.equal(Object.hasOwn(result, 'code'), false);
});

test('CIE disabilitata restituisce 404 senza esporre codice', () => {
  const result = getPublicIdentityError(
    { code: IDENTITY_ERROR_CODES.CIE_OIDC_DISABLED },
    { status: 503, error: 'fallback' }
  );

  assert.deepEqual(result, {
    status: 404,
    error: 'CIE non ancora attiva'
  });
});

test('errore sconosciuto usa solo il fallback sicuro', () => {
  const result = getPublicIdentityError(
    { code: 'DATABASE_FAILURE', message: 'postgres-secret' },
    { status: 503, error: 'Configurazione CIE non pronta' }
  );

  assert.deepEqual(result, {
    status: 503,
    error: 'Configurazione CIE non pronta'
  });
  assert.equal(result.error.includes('postgres'), false);
});
