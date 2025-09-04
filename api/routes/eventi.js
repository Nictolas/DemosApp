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
      'SELECT * FROM eventi ORDER BY created_at ASC'
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
    const { nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, orario_evento } = req.body;
    
    if (!nome_evento || !tipologia_evento) {
      return res.status(400).json({
        success: false,
        error: 'Nome evento e tipologia sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO eventi (nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, orario_evento) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, orario_evento]
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
