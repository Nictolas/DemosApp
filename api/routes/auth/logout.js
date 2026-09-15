const express = require('express');
const { verifyRefreshToken } = require('../../utils/jwt');
const { revokeRefreshSession } = require('../../services/sessionService');

const router = express.Router();

// Endpoint per il logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (refreshToken && typeof refreshToken === 'string') {
      let decoded = null;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch (error) {
        // Un refresh token già scaduto/non valido non può essere riutilizzato: il logout locale può proseguire.
        console.warn('Logout: refresh token già non valido o scaduto');
      }

      if (decoded) {
        const sessionId = decoded.sid || decoded.jti;
        if (!sessionId) {
          throw new Error('Refresh token privo di identificatore di sessione');
        }

        await revokeRefreshSession({
          sessionId,
          userId: decoded.userId,
          refreshToken,
          ipAddress: req.ip || req.connection?.remoteAddress || null,
          userAgent: req.get('User-Agent') || null,
        });
      }
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
