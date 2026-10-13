const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken, requireAdmin } = require('../middleware/auth');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER VERIFICA RUOLI =====

// Dati di ruolo di un account arbitrario: diagnostica riservata agli Admin.
router.get('/utente/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, email, ruolo, email_verificata FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Errore nella verifica ruolo utente:', error);
    res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Verifica il privilegio Admin dell'account autenticato; non accetta più user_id arbitrari.
router.post('/check-admin', verifyToken, async (req, res) => {
  res.json({
    success: true,
    isAdmin: Boolean(req.user?.isAdmin),
    ruolo: req.userRole || req.user?.ruolo || null
  });
});

module.exports = router;
