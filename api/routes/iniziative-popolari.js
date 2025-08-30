const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER INIZIATIVE POPOLARI =====

// GET /api/iniziative-popolari - Lista iniziative popolari
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM iniziative_popolari ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/iniziative-popolari - Crea nuova iniziativa popolare
router.post('/', async (req, res) => {
  try {
    const { titolo, descrizione, promotore_id, obiettivi } = req.body;
    
    if (!titolo || !descrizione || !promotore_id) {
      return res.status(400).json({
        success: false,
        error: 'Titolo, descrizione e promotore sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO iniziative_popolari (titolo, descrizione, promotore_id, obiettivi, data_creazione) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [titolo, descrizione, promotore_id, obiettivi]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
