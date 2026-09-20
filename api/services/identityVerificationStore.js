const { getPool } = require('../config/database');
const { derivePersonKey } = require('./identityVerificationService');

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
    verified: row.status === 'verified',
    provider: row.provider,
    status: row.status,
    verifiedAt: row.verified_at,
    detachedAt: row.detached_at,
    retentionUntil: row.retention_until
  };
}

function validateProvider(provider) {
  if (typeof provider !== 'string' || !/^[A-Za-z0-9_-]{2,32}$/.test(provider)) {
    throw new IdentityVerificationError('INVALID_PROVIDER', 'Provider identita non valido');
  }

  return provider.toUpperCase();
}

async function getIdentityVerificationStatus(userId, db = getPool()) {
  if (!userId) {
    throw new IdentityVerificationError('INVALID_USER_ID', 'userId obbligatorio');
  }

  const result = await db.query(
    `SELECT provider, status, verified_at, detached_at, retention_until
     FROM identity_verifications
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { verified: false };
  }

  return sanitizeRow(result.rows[0]);
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
  { userId, fiscalNumber, provider = 'CIE' },
  db = getPool()
) {
  if (!userId) {
    throw new IdentityVerificationError('INVALID_USER_ID', 'userId obbligatorio');
  }

  const normalizedProvider = validateProvider(provider);
  const personKey = derivePersonKey(fiscalNumber);

  const existing = await findInternalVerificationByUserId(userId, db);
  if (existing) {
    if (
      existing.person_key === personKey &&
      existing.provider === normalizedProvider &&
      existing.status === 'verified'
    ) {
      return { created: false, ...sanitizeRow(existing) };
    }

    throw new IdentityVerificationError(
      'ACCOUNT_ALREADY_VERIFIED',
      'Account gia associato a una identita verificata'
    );
  }

  try {
    const inserted = await db.query(
      `INSERT INTO identity_verifications
        (user_id, person_key, provider, status, verified_at, updated_at)
       VALUES ($1, $2, $3, 'verified', NOW(), NOW())
       RETURNING provider, status, verified_at, detached_at, retention_until`,
      [userId, personKey, normalizedProvider]
    );

    return { created: true, ...sanitizeRow(inserted.rows[0]) };
  } catch (error) {
    if (error?.code !== '23505') {
      throw error;
    }

    // Gestisce anche la race condition di due callback simultanee sullo stesso account.
    const afterConflict = await findInternalVerificationByUserId(userId, db);
    if (
      afterConflict &&
      afterConflict.person_key === personKey &&
      afterConflict.provider === normalizedProvider &&
      afterConflict.status === 'verified'
    ) {
      return { created: false, ...sanitizeRow(afterConflict) };
    }

    if (error.constraint === 'identity_verifications_person_key_key') {
      throw new IdentityVerificationError(
        'PERSON_ALREADY_LINKED',
        'Questa persona e gia associata a un altro account DEMOS'
      );
    }

    if (error.constraint === 'identity_verifications_user_id_key') {
      throw new IdentityVerificationError(
        'ACCOUNT_ALREADY_VERIFIED',
        'Account gia associato a una identita verificata'
      );
    }

    throw new IdentityVerificationError(
      'IDENTITY_CONFLICT',
      'Conflitto durante la verifica identita'
    );
  }
}

module.exports = {
  IdentityVerificationError,
  getIdentityVerificationStatus,
  registerVerifiedIdentity
};
