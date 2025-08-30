const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER CATEGORIE =====

// GET /api/categorie - Lista categorie
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categorie ORDER BY nome'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero categorie:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/categorie - Aggiungi categoria
router.post('/', async (req, res) => {
  try {
    const { nome, descrizione } = req.body;
    
    if (!nome) {
      return res.status(400).json({
        success: false,
        error: 'Nome categoria è obbligatorio'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO categorie (nome, descrizione) VALUES ($1, $2) RETURNING *',
      [nome, descrizione]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta categoria:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
