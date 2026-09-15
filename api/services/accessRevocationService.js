const redisCache = require('./redisCache');
const { keys } = require('../config/cacheKeys');

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

function getRedisClientOrThrow() {
  const client = redisCache.getClient();
  if (!client) throw unavailableError();
  return client;
}

async function isAccessSessionRevoked(decoded) {
  const sessionId = getAccessSessionId(decoded);
  if (!sessionId) return false;

  const client = getRedisClientOrThrow();
  try {
    const value = await client.get(keys.revokedAccessSession(sessionId));
    return value === '1' || value === 1 || value === true || value === 'revoked';
  } catch (error) {
    throw unavailableError(error);
  }
}

async function revokeAccessSession(sessionId, ttlSeconds = MAX_ACCESS_TOKEN_TTL_SECONDS) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('Identificatore sessione access non valido');
  }

  const client = getRedisClientOrThrow();
  try {
    await client.set(
      keys.revokedAccessSession(sessionId.trim()),
      '1',
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
