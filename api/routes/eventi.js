const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER EVENTI =====

// GET /api/eventi - Lista eventi
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM eventi ORDER BY data_inizio ASC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero eventi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/eventi - Crea nuovo evento
router.post('/', async (req, res) => {
  try {
    const { titolo, descrizione, data_inizio, data_fine, luogo, organizzatore_id } = req.body;
    
    if (!titolo || !data_inizio || !organizzatore_id) {
      return res.status(400).json({
        success: false,
        error: 'Titolo, data inizio e organizzatore sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO eventi (titolo, descrizione, data_inizio, data_fine, luogo, organizzatore_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [titolo, descrizione, data_inizio, data_fine, luogo, organizzatore_id]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione evento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
