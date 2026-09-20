const {
  IdentityVerificationError,
  getIdentityVerificationStatus,
  registerVerifiedIdentity
} = require('./identityVerificationStore');

function getFiscalNumberFromVerifiedClaims(claims) {
  if (!claims || typeof claims !== 'object') {
    throw new Error('Claims CIE mancanti');
  }

  const fiscalNumber = claims.fiscal_number;
  if (typeof fiscalNumber !== 'string' || !fiscalNumber.trim()) {
    throw new Error('Claim fiscal_number mancante');
  }

  return fiscalNumber;
}

async function assertAccountCanStartCieVerification(userId, db) {
  const status = await getIdentityVerificationStatus(userId, db);

  if (status.verified) {
    throw new IdentityVerificationError(
      'ACCOUNT_ALREADY_VERIFIED',
      'Account gia associato a una identita verificata'
    );
  }

  return true;
}

/**
 * Completa la verifica SOLO dopo che un futuro modulo OIDC CIE avrà
 * verificato firma, issuer, audience, state e nonce.
 *
 * Non chiamare questa funzione con dati ricevuti direttamente dal client.
 */
async function completeCieVerificationFromVerifiedClaims(
  { userId, claims },
  db
) {
  const fiscalNumber = getFiscalNumberFromVerifiedClaims(claims);

  return registerVerifiedIdentity(
    {
      userId,
      fiscalNumber,
      provider: 'CIE'
    },
    db
  );
}

module.exports = {
  getFiscalNumberFromVerifiedClaims,
  assertAccountCanStartCieVerification,
  completeCieVerificationFromVerifiedClaims
};
