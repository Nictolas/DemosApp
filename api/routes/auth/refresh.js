const express = require('express');
const { generateTokenPair, verifyRefreshToken } = require('../../utils/jwt');
const { authLimiter } = require('../../middleware/rateLimiting');
const { getPool } = require('../../config/database');

const router = express.Router();
const pool = getPool();

/**
 * POST /api/auth/refresh
 * Rinnova la coppia di token senza usare credenziali email/password.
 */
router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Refresh token richiesto',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const userResult = await pool.query(
      `SELECT id, email, ruolo, nome, cognome, status
       FROM users
       WHERE id = $1 AND (status = 'A' OR status = 'a')`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
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
    });

    return res.json({
      success: true,
      message: 'Token aggiornati con successo',
      ...tokens,
    });
  } catch (error) {
    console.error('❌ Errore durante refresh token:', error?.message || error);
    return res.status(401).json({
      success: false,
      error: 'Refresh token non valido',
      message: 'Effettua nuovamente l’accesso',
    });
  }
});

module.exports = router;
