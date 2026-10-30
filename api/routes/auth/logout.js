const express = require('express');
const { verifyAccessToken, verifyRefreshToken } = require('../../utils/jwt');
const { revokeRefreshSession } = require('../../services/sessionService');
const {
  MAX_ACCESS_TOKEN_TTL_SECONDS,
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
      // Revoca immediata dell'access token corrente su tutte le istanze backend.
      if (decodedAccess) {
        await revokeDecodedAccessToken(decodedAccess);
      }

      // I token moderni condividono lo stesso sid. Estendere la revoca a 24 ore
      // impedisce l'uso di qualunque access token già emesso per quella sessione.
      if (refreshSessionId) {
        await revokeAccessSession(refreshSessionId, MAX_ACCESS_TOKEN_TTL_SECONDS);
      }
    } catch (error) {
      if (error?.code === 'ACCESS_REVOCATION_STORE_UNAVAILABLE') {
        return res.status(503).json({
          success: false,
          error: 'Revoca sessione temporaneamente non disponibile',
          message: 'Riprova il logout tra poco.',
        });
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Logout effettuato con successo'
    });
  } catch (error) {
    // Exception messages may contain token, SQL or request metadata: never log them.
    console.error('Logout: errore interno durante la revoca della sessione');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante il logout'
    });
  }
});

module.exports = router;
