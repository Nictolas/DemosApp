const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER PROGRAMMA =====

// GET /api/programma - Lista programmi
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM programmi ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero programmi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/programma - Crea nuovo programma
router.post('/', async (req, res) => {
  try {
    const { titolo, descrizione, candidato_id, punti_chiave } = req.body;
    
    if (!titolo || !descrizione || !candidato_id) {
      return res.status(400).json({
        success: false,
        error: 'Titolo, descrizione e candidato sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO programmi (titolo, descrizione, candidato_id, punti_chiave, data_creazione) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [titolo, descrizione, candidato_id, punti_chiave]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione programma:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
