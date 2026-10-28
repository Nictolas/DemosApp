const {
  IdentityVerificationError,
  getIdentityVerificationStatus,
  registerVerifiedIdentity
} = require('./identityVerificationStore');
const { IDENTITY_PROVIDERS, IDENTITY_ERROR_CODES } = require('../constants/identityVerification');
const { getPool } = require('../config/database');
const { persistVerifiedCieSex } = require('../utils/cieSex');

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
      IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED,
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

  const sesso = claims.sesso ?? null;
  if (sesso == null) {
    return registerVerifiedIdentity(
      { userId, fiscalNumber, provider: IDENTITY_PROVIDERS.CIE },
      db
    );
  }
  if (sesso !== 'M' && sesso !== 'F') {
    throw new Error('Sesso CIE non valido');
  }

  // La verifica CIE e l'attributo anagrafico devono essere atomici.
  const connection = db || getPool();
  const ownsTransaction = typeof connection.connect === 'function';
  const client = ownsTransaction ? await connection.connect() : connection;
  try {
    if (ownsTransaction) await client.query('BEGIN');
    const verified = await registerVerifiedIdentity(
      { userId, fiscalNumber, provider: IDENTITY_PROVIDERS.CIE },
      client
    );
    await persistVerifiedCieSex(client, userId, sesso);
    if (ownsTransaction) await client.query('COMMIT');
    return verified;
  } catch (error) {
    if (ownsTransaction) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
}

module.exports = {
  getFiscalNumberFromVerifiedClaims,
  assertAccountCanStartCieVerification,
  completeCieVerificationFromVerifiedClaims
};
