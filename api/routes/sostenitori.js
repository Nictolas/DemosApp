const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER SOSTENITORI =====

// GET /api/sostenitori - Lista sostenitori per iniziativa
router.get('/', async (req, res) => {
  try {
    const { iniziativa_id } = req.query;
    
    if (!iniziativa_id) {
      return res.status(400).json({
        success: false,
        error: 'ID iniziativa richiesto'
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM sostenitori WHERE iniziativa_id = $1 ORDER BY data_adesione DESC',
      [iniziativa_id]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero sostenitori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/sostenitori - Aggiungi sostenitore
router.post('/', async (req, res) => {
  try {
    const { iniziativa_id, user_id, tipo_sostegno } = req.body;
    
    if (!iniziativa_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID iniziativa e ID utente sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO sostenitori (iniziativa_id, user_id, tipo_sostegno, data_adesione) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [iniziativa_id, user_id, tipo_sostegno]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta sostenitore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
