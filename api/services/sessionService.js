const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');

const pool = getPool();

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function getTokenExpiry(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded.exp !== 'number') {
    throw new Error('Refresh token senza scadenza valida');
  }
  return new Date(decoded.exp * 1000);
}

async function rotateRefreshSession({
  sessionId,
  userId,
  oldRefreshToken,
  newRefreshToken,
  ipAddress = null,
  userAgent = null,
}) {
  if (!sessionId || !userId || !oldRefreshToken || !newRefreshToken) {
    throw new Error('Dati sessione incompleti');
  }

  const oldHash = hashRefreshToken(oldRefreshToken);
  const newHash = hashRefreshToken(newRefreshToken);
  const oldExpiresAt = getTokenExpiry(oldRefreshToken);
  const newExpiresAt = getTokenExpiry(newRefreshToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let current = await client.query(
      `SELECT id, user_id, session_token, is_active, expires_at
       FROM active_sessions
       WHERE id = $1
       FOR UPDATE`,
      [sessionId]
    );

    if (current.rows.length === 0) {
      const inserted = await client.query(
        `INSERT INTO active_sessions (
           id, user_id, session_token, ip_address, user_agent,
           login_time, last_activity, is_active, expires_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), TRUE, $6, NOW())
         ON CONFLICT (id) DO NOTHING
         RETURNING id, user_id, session_token, is_active, expires_at`,
        [sessionId, String(userId), oldHash, ipAddress, userAgent, oldExpiresAt]
      );

      current = inserted.rows.length > 0
        ? inserted
        : await client.query(
          `SELECT id, user_id, session_token, is_active, expires_at
           FROM active_sessions
           WHERE id = $1
           FOR UPDATE`,
          [sessionId]
        );
    }

    const session = current.rows[0];
    const isExpired = session?.expires_at && new Date(session.expires_at) <= new Date();

    if (
      !session ||
      String(session.user_id) !== String(userId) ||
      session.session_token !== oldHash ||
      session.is_active !== true ||
      isExpired
    ) {
      throw new Error('Refresh token già usato, revocato o non associato alla sessione');
    }

    await client.query(
      `UPDATE active_sessions
       SET session_token = $1,
           ip_address = COALESCE($2, ip_address),
           user_agent = COALESCE($3, user_agent),
           last_activity = NOW(),
           is_active = TRUE,
           expires_at = $4
       WHERE id = $5`,
      [newHash, ipAddress, userAgent, newExpiresAt, sessionId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function revokeRefreshSession({
  sessionId,
  userId,
  refreshToken,
  ipAddress = null,
  userAgent = null,
}) {
  if (!sessionId || !userId || !refreshToken) {
    throw new Error('Dati sessione incompleti');
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = getTokenExpiry(refreshToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE active_sessions
       SET is_active = FALSE,
           last_activity = NOW(),
           ip_address = COALESCE($3, ip_address),
           user_agent = COALESCE($4, user_agent)
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, String(userId), ipAddress, userAgent]
    );

    if (updated.rows.length === 0) {
      await client.query(
        `INSERT INTO active_sessions (
           id, user_id, session_token, ip_address, user_agent,
           login_time, last_activity, is_active, expires_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), FALSE, $6, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [sessionId, String(userId), tokenHash, ipAddress, userAgent, expiresAt]
      );

      // Copre una possibile gara con un refresh che abbia creato la stessa sessione.
      await client.query(
        `UPDATE active_sessions
         SET is_active = FALSE,
             last_activity = NOW(),
             ip_address = COALESCE($3, ip_address),
             user_agent = COALESCE($4, user_agent)
         WHERE id = $1 AND user_id = $2`,
        [sessionId, String(userId), ipAddress, userAgent]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  rotateRefreshSession,
  revokeRefreshSession,
};
