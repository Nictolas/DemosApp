const express = require('express');
const { generateTokenPair, verifyRefreshToken } = require('../../utils/jwt');
const { authLimiter } = require('../../middleware/rateLimiting');
const { getPool } = require('../../config/database');
const { rotateRefreshSession } = require('../../services/sessionService');
const {
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../../services/refreshTokenCookieService');

const router = express.Router();
const pool = getPool();

/**
 * POST /api/auth/refresh
 * Rinnova la coppia di token e ruota il refresh token in modo monouso.
 *
 * Migrazione trasporto:
 * - browser: preferisce il cookie HttpOnly demos_refresh;
 * - client legacy/mobile: mantiene temporaneamente il body refreshToken.
 */
router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const { refreshToken, source } = getRefreshTokenFromRequest(req);

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token richiesto',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const sessionId = decoded.sid || decoded.jti;

    if (!sessionId) {
      throw new Error('Refresh token privo di identificatore di sessione');
    }

    const userResult = await pool.query(
      `SELECT id, email, ruolo, nome, cognome, status
       FROM users
       WHERE id = $1 AND (status = 'A' OR status = 'a')`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Effettua nuovamente l’accesso',
      });
    }

    const user = userResult.rows[0];
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.ruolo,
      nome: user.nome,
      cognome: user.cognome,
      sid: sessionId,
    });

    await rotateRefreshSession({
      sessionId,
      userId: user.id,
      oldRefreshToken: refreshToken,
      newRefreshToken: tokens.refreshToken,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
    });

    setRefreshTokenCookie(res, tokens.refreshToken);

    const payload = {
      success: true,
      message: 'Token aggiornati con successo',
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType,
    };

    // Compatibilità temporanea: solo chi è ancora entrato via body riceve il nuovo
    // refresh token nel JSON. In modalità cookie il refresh token non è JS-readable.
    if (source === 'body') {
      payload.refreshToken = tokens.refreshToken;
    }

    return res.json(payload);
  } catch (error) {
    clearRefreshTokenCookie(res);
    console.error('❌ Errore durante refresh token:', error?.message || error);
    return res.status(401).json({
      success: false,
      error: 'Refresh token non valido, già usato o revocato',
      message: 'Effettua nuovamente l’accesso',
    });
  }
});

module.exports = router;
