const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER CANDIDATI =====

// GET /api/candidati - Lista candidati
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM candidati ORDER BY cognome, nome'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/candidati - Aggiungi candidato
router.post('/', async (req, res) => {
  try {
    const { nome, cognome, partito, circoscrizione, tipo_elezione } = req.body;
    
    if (!nome || !cognome || !partito) {
      return res.status(400).json({
        success: false,
        error: 'Nome, cognome e partito sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO candidati (nome, cognome, partito, circoscrizione, tipo_elezione) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, cognome, partito, circoscrizione, tipo_elezione]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta candidato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
