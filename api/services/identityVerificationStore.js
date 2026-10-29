const { getPool } = require('../config/database');
const { derivePersonKey } = require('./identityVerificationService');
const { IDENTITY_PROVIDERS, IDENTITY_ERROR_CODES } = require('../constants/identityVerification');

class IdentityVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IdentityVerificationError';
    this.code = code;
  }
}

function sanitizeRow(row) {
  if (!row) return null;

  return {
    verified: row.status === 'verified' && row.detached_at == null,
    provider: row.provider,
    status: row.status,
    verifiedAt: row.verified_at,
    detachedAt: row.detached_at,
    retentionUntil: row.retention_until
  };
}

function validateProvider(provider) {
  if (typeof provider !== 'string' || !/^[A-Za-z0-9_-]{2,32}$/.test(provider)) {
    throw new IdentityVerificationError(IDENTITY_ERROR_CODES.INVALID_PROVIDER, 'Provider identita non valido');
  }

  return provider.toUpperCase();
}

async function getIdentityVerificationStatus(userId, db = getPool()) {
  if (!userId) {
    throw new IdentityVerificationError(IDENTITY_ERROR_CODES.INVALID_USER_ID, 'userId obbligatorio');
  }

  const result = await db.query(
    `SELECT provider, status
     FROM identity_verifications
     WHERE user_id = $1 AND detached_at IS NULL
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { verified: false };
  }

  const row = result.rows[0];
  return {
    verified: row.status === 'verified',
    provider: row.provider
  };
}

async function findInternalVerificationByUserId(userId, db) {
  const result = await db.query(
    `SELECT person_key, provider, status, verified_at, detached_at, retention_until
     FROM identity_verifications
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function registerVerifiedIdentity(
  { userId, fiscalNumber, provider = IDENTITY_PROVIDERS.CIE },
  db = getPool()
) {
  if (!userId) {
    throw new IdentityVerificationError(IDENTITY_ERROR_CODES.INVALID_USER_ID, 'userId obbligatorio');
  }

  const normalizedProvider = validateProvider(provider);
  const personKey = derivePersonKey(fiscalNumber);

  const existing = await findInternalVerificationByUserId(userId, db);
  if (existing) {
    if (
      existing.person_key === personKey &&
      existing.provider === normalizedProvider &&
      existing.status === 'verified' &&
      existing.detached_at == null
    ) {
      return { created: false, ...sanitizeRow(existing) };
    }

    throw new IdentityVerificationError(
      IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED,
      'Account gia associato a una identita verificata'
    );
  }

  // La collisione NON deve interrompere la transazione PostgreSQL:
  // un INSERT che lancia 23505 invalida ogni query successiva fino al rollback.
  // ON CONFLICT DO NOTHING permette invece di leggere il vincitore della race.
  const inserted = await db.query(
    `INSERT INTO identity_verifications
      (user_id, person_key, provider, status, verified_at, updated_at)
     VALUES ($1, $2, $3, 'verified', NOW(), NOW())
     ON CONFLICT DO NOTHING
     RETURNING provider, status, verified_at, detached_at, retention_until`,
    [userId, personKey, normalizedProvider]
  );
  if (inserted.rows.length === 1) {
    return { created: true, ...sanitizeRow(inserted.rows[0]) };
  }

  const afterConflict = await findInternalVerificationByUserId(userId, db);
  if (afterConflict) {
    if (
      afterConflict.person_key === personKey &&
      afterConflict.provider === normalizedProvider &&
      afterConflict.status === 'verified' &&
      afterConflict.detached_at == null
    ) {
      return { created: false, ...sanitizeRow(afterConflict) };
    }
    throw new IdentityVerificationError(
      IDENTITY_ERROR_CODES.ACCOUNT_ALREADY_VERIFIED,
      'Account gia associato a una identita verificata'
    );
  }

  const personOwner = await db.query(
    'SELECT 1 FROM identity_verifications WHERE person_key = $1 LIMIT 1',
    [personKey]
  );
  if (personOwner.rows.length > 0) {
    throw new IdentityVerificationError(
      IDENTITY_ERROR_CODES.PERSON_ALREADY_LINKED,
      'Questa persona e gia associata a un altro account DEMOS'
    );
  }

  throw new IdentityVerificationError(
    IDENTITY_ERROR_CODES.IDENTITY_CONFLICT,
    'Conflitto durante la verifica identita'
  );
}

module.exports = {
  IdentityVerificationError,
  getIdentityVerificationStatus,
  registerVerifiedIdentity
};
