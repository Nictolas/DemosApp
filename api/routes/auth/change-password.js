const express = require('express');
const bcrypt = require('bcryptjs');
const { verifyToken } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiting');
const { getPool } = require('../../config/database');

const router = express.Router();
const pool = getPool();
const SALT_ROUNDS = 10;

/**
 * 🔐 CAMBIO PASSWORD (utente autenticato)
 * POST /api/auth/change-password
 */
router.post('/change-password', authLimiter, verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato',
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Password attuale e nuova password sono obbligatorie',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La nuova password deve essere di almeno 6 caratteri',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'La nuova password deve essere diversa da quella attuale',
      });
    }

    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
      });
    }

    const user = userResult.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'Questo account non ha una password impostata',
      });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Password attuale non corretta',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message: 'Password aggiornata con successo',
    });
  } catch (error) {
    console.error('❌ Errore change-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore durante il cambio password',
    });
  }
});

module.exports = router;
