const express = require('express');
const { verifyAccessToken, verifyRefreshToken } = require('../../utils/jwt');
const { revokeRefreshSession } = require('../../services/sessionService');
const {
  MAX_ACCESS_TOKEN_TTL_SECONDS,
  getAccessSessionId,
  revokeAccessSession,
  revokeDecodedAccessToken,
} = require('../../services/accessRevocationService');

const router = express.Router();

// Endpoint per il logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    let decodedAccess = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      try {
        decodedAccess = verifyAccessToken(accessToken);
      } catch (error) {
        // Un access token già scaduto/non valido non necessita revoca.
        console.warn('Logout: access token già non valido o scaduto');
      }
    }

    let refreshSessionId = null;
    if (refreshToken && typeof refreshToken === 'string') {
      let decoded = null;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch (error) {
        // Un refresh token già scaduto/non valido non può essere riutilizzato: il logout locale può proseguire.
        console.warn('Logout: refresh token già non valido o scaduto');
      }

      if (decoded) {
        refreshSessionId = decoded.sid || decoded.jti;
        if (!refreshSessionId) {
          throw new Error('Refresh token privo di identificatore di sessione');
        }

        // Revoca persistente del refresh token/sessione nel database.
        await revokeRefreshSession({
          sessionId: refreshSessionId,
          userId: decoded.userId,
          refreshToken,
          ipAddress: req.ip || req.connection?.remoteAddress || null,
          userAgent: req.get('User-Agent') || null,
        });
      }
    }

    try {
      // Revoca immediata e distribuita dell'access token corrente.
      if (decodedAccess) {
        await revokeDecodedAccessToken(decodedAccess);
      }

      // Per i token moderni access e refresh condividono lo stesso sid.
      // Manteniamo la sessione revocata per l'intera durata massima di un access token.
      if (refreshSessionId) {
        const accessSessionId = getAccessSessionId(decodedAccess);
        if (!accessSessionId || accessSessionId !== refreshSessionId) {
          await revokeAccessSession(refreshSessionId, MAX_ACCESS_TOKEN_TTL_SECONDS);
        } else {
          // Estende comunque la revoca fino alla durata massima della sessione access.
          await revokeAccessSession(refreshSessionId, MAX_ACCESS_TOKEN_TTL_SECONDS);
        }
      }
    } catch (error) {
      if (error?.code === 'ACCESS_REVOCATION_STORE_UNAVAILABLE') {
        return res.status(503).json({
          success: false,
          error: 'Revoca sessione temporaneamente non disponibile',
          message: 'Il logout locale è avvenuto, ma la revoca server va ritentata.',
        });
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Logout effettuato con successo'
    });
  } catch (error) {
    console.error('Errore durante logout:', error?.message || error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante il logout'
    });
  }
});

module.exports = router;
