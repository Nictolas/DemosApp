const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - Lista candidati capo di stato
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM candidati_capo_stato ORDER BY nome'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero candidati capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/capo-stato - Aggiungi candidato capo di stato
router.post('/', async (req, res) => {
  try {
    const { nome, partito, programma } = req.body;
    
    if (!nome || !partito) {
      return res.status(400).json({
        success: false,
        error: 'Nome e partito sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO candidati_capo_stato (nome, partito, programma) VALUES ($1, $2, $3) RETURNING *',
      [nome, partito, programma]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta candidato capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
