const redisCache = require('./redisCache');
const { keys, ttl } = require('../config/cacheKeys');
const { getPool } = require('../config/database');

const pool = getPool();
const MAX_ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;

function getAccessSessionId(decoded) {
  if (!decoded || typeof decoded !== 'object') return null;
  const id = decoded.sid || decoded.jti;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function getRemainingAccessTtlSeconds(decoded) {
  const now = Math.floor(Date.now() / 1000);
  if (!decoded || typeof decoded.exp !== 'number') return MAX_ACCESS_TOKEN_TTL_SECONDS;
  return Math.max(1, Math.min(MAX_ACCESS_TOKEN_TTL_SECONDS, Math.ceil(decoded.exp - now)));
}

function unavailableError(cause) {
  const error = new Error('Store revoca access token non disponibile');
  error.code = 'ACCESS_REVOCATION_STORE_UNAVAILABLE';
  if (cause) error.cause = cause;
  return error;
}

async function readSessionRevocationFromDatabase(sessionId) {
  try {
    const result = await pool.query(
      `SELECT is_active, expires_at
       FROM active_sessions
       WHERE id = $1
       LIMIT 1`,
      [sessionId]
    );

    if (result.rows.length === 0) return false;

    const session = result.rows[0];
    if (session.is_active !== true) return true;

    return Boolean(
      session.expires_at &&
      new Date(session.expires_at).getTime() <= Date.now()
    );
  } catch (error) {
    // sid/jti sono UUID. Per token legacy o valori non compatibili, l'assenza
    // di una riga persistente non deve trasformarsi in un errore applicativo.
    if (error?.code === '22P02') return false;
    throw unavailableError(error);
  }
}

async function writeCachedState(client, sessionId, state, ttlSeconds) {
  if (!client) return;
  const safeTtl = Math.max(1, Math.floor(ttlSeconds));
  try {
    await client.set(keys.accessSessionState(sessionId), state, { ex: safeTtl });
  } catch (error) {
    console.warn('Revoca access token: impossibile aggiornare cache Redis:', error.message);
  }
}

async function isAccessSessionRevoked(decoded) {
  const sessionId = getAccessSessionId(decoded);
  if (!sessionId) return false;

  const client = redisCache.getClient();
  if (client) {
    try {
      const cachedState = await client.get(keys.accessSessionState(sessionId));
      if (cachedState === 'revoked') return true;
      if (cachedState === 'active') return false;
    } catch (error) {
      console.warn('Revoca access token: lettura Redis fallita, uso fallback DB:', error.message);
    }
  }

  const revoked = await readSessionRevocationFromDatabase(sessionId);

  if (client) {
    const cacheTtl = revoked
      ? getRemainingAccessTtlSeconds(decoded)
      : Math.max(1, Number(ttl.accessSessionActiveState) || 5);
    await writeCachedState(client, sessionId, revoked ? 'revoked' : 'active', cacheTtl);
  }

  return revoked;
}

async function revokeAccessSession(sessionId, ttlSeconds = MAX_ACCESS_TOKEN_TTL_SECONDS) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('Identificatore sessione access non valido');
  }

  const client = redisCache.getClient();
  if (!client) {
    throw unavailableError();
  }

  try {
    await client.set(
      keys.accessSessionState(sessionId.trim()),
      'revoked',
      { ex: Math.max(1, Math.floor(ttlSeconds)) }
    );
  } catch (error) {
    throw unavailableError(error);
  }
}

async function revokeDecodedAccessToken(decoded) {
  const sessionId = getAccessSessionId(decoded);
  if (!sessionId) return false;
  await revokeAccessSession(sessionId, getRemainingAccessTtlSeconds(decoded));
  return true;
}

module.exports = {
  MAX_ACCESS_TOKEN_TTL_SECONDS,
  getAccessSessionId,
  getRemainingAccessTtlSeconds,
  isAccessSessionRevoked,
  revokeAccessSession,
  revokeDecodedAccessToken,
};
