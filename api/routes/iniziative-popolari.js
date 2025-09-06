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
      'SELECT * FROM iniziative_popolari ORDER BY created_at DESC'
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
    const { nome, userId, dataInizio, dataFine, sitoWeb, status, quorum } = req.body;
    
    if (!nome || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Nome e userId sono obbligatori'
      });
    }
    
    // Genera un ID univoco per l'iniziativa
    const iniziativaId = `iniziativa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await pool.query(
      'INSERT INTO iniziative_popolari (id, userId, nome, dataInizio, dataFine, sitoWeb, status, quorum, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *',
      [iniziativaId, userId, nome, dataInizio, dataFine, sitoWeb, status, quorum]
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
