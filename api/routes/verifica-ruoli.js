const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

// ===== ENDPOINTS PER VERIFICA RUOLI =====

// GET /api/verifica-ruoli/utente/:id - Verifica ruolo utente
router.get('/utente/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT id, email, ruolo, email_verificata FROM users WHERE id = $1',
      [id]
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
    console.error('❌ Errore nella verifica ruolo utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/verifica-ruoli/check-admin - Verifica se utente è admin
router.post('/check-admin', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    const result = await pool.query(
      'SELECT ruolo FROM users WHERE id = $1',
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const isAdmin = result.rows[0].ruolo === "AD";
    
    res.json({
      success: true,
      isAdmin,
      ruolo: result.rows[0].ruolo
    });
  } catch (error) {
    console.error('❌ Errore nella verifica admin:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
