const { IDENTITY_ERROR_CODES } = require('../constants/identityVerification');

const PUBLIC_IDENTITY_ERRORS = Object.freeze({
  [IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED,
    exposeCode: true,
    error: 'Account gia associato a una identita verificata'
  }),
  [IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED,
    exposeCode: false,
    error: 'Identita gia associata a un altro account DEMOS'
  }),
  [IDENTITY_ERROR_CODES.IDENTITY_CONFLICT]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.IDENTITY_CONFLICT,
    exposeCode: false,
    error: 'Conflitto durante la verifica identita'
  }),
  [IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE]: Object.freeze({
    status: 409,
    code: IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE,
    exposeCode: true,
    error: 'Verifica CIE gia in corso'
  }),
  [IDENTITY_ERROR_CODES.CIE_OIDC_DISABLED]: Object.freeze({
    status: 404,
    code: IDENTITY_ERROR_CODES.CIE_OIDC_DISABLED,
    exposeCode: false,
    error: 'CIE non ancora attiva'
  })
});

function getPublicIdentityError(error, fallback) {
  const known = PUBLIC_IDENTITY_ERRORS[error?.code];
  if (known) {
    return {
      status: known.status,
      ...(known.exposeCode ? { code: known.code } : {}),
      error: known.error
    };
  }

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
