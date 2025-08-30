const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER COMUNICAZIONI =====

// GET /api/comunicazioni - Lista comunicazioni
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicazioni ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero comunicazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/comunicazioni - Crea nuova comunicazione
router.post('/', async (req, res) => {
  try {
    const { titolo, contenuto, autore_id, tipo } = req.body;
    
    if (!titolo || !contenuto || !autore_id) {
      return res.status(400).json({
        success: false,
        error: 'Titolo, contenuto e autore sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO comunicazioni (titolo, contenuto, autore_id, tipo, data_creazione) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [titolo, contenuto, autore_id, tipo]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
