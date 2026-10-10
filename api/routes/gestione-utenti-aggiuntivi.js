const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken, requireAdmin } = require('../middleware/auth');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER GESTIONE UTENTI AGGIUNTIVI =====

router.use(verifyToken, requireAdmin);

// GET /api/gestione-utenti-aggiuntivi/ruoli - Lista ruoli disponibili
router.get('/ruoli', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT ruolo FROM users WHERE ruolo IS NOT NULL ORDER BY ruolo'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero ruoli:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT legacy ritirata: users.ruolo è solo una proiezione di compatibilità.
router.put('/ruolo', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'LEGACY_ROLE_MUTATION_RETIRED',
    message: 'Usa i flussi canonici di account type, capability, candidature e mandati.'
  });
});

module.exports = router;
