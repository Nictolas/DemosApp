const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER GESTIONE UTENTI AGGIUNTIVI =====

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

// PUT /api/gestione-utenti-aggiuntivi/ruolo - Aggiorna ruolo utente
router.put('/ruolo', async (req, res) => {
  try {
    const { user_id, nuovo_ruolo } = req.body;
    
    if (!user_id || !nuovo_ruolo) {
      return res.status(400).json({
        success: false,
        error: 'ID utente e nuovo ruolo sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'UPDATE users SET ruolo = $1 WHERE id = $2 RETURNING *',
      [nuovo_ruolo, user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento ruolo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
