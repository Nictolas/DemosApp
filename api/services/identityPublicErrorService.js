const { IDENTITY_ERROR_CODES } = require('../constants/identityVerification');

const PUBLIC_IDENTITY_ERRORS = Object.freeze({
  [IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED,
    error: 'Account gia associato a una identita verificata'
  }),
  [IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED,
    error: 'Identita gia associata a un altro account DEMOS'
  }),
  [IDENTITY_ERROR_CODES.IDENTITY_CONFLICT]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.IDENTITY_CONFLICT,
    error: 'Conflitto durante la verifica identita'
  }),
  [IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE,
    error: 'Verifica CIE gia in corso'
  }),
  [IDENTITY_ERROR_CODES.CIE_OIDC_DISABLED]: Object.freeze({
    status: 404,
    code: IDENTITY_ERROR_CODES.CIE_OIDC_DISABLED,
    error: 'CIE non ancora attiva'
  })
});

function getPublicIdentityError(error, fallback) {
  const known = PUBLIC_IDENTITY_ERRORS[error?.code];
  if (known) return { ...known };

  return {
    status: fallback.status,
    ...(fallback.code ? { code: fallback.code } : {}),
    error: fallback.error
  };
}

module.exports = {
  PUBLIC_IDENTITY_ERRORS,
  getPublicIdentityError
};
