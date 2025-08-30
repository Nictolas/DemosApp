const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER REAZIONI COMUNICAZIONI =====

// GET /api/reazioni-comunicazioni - Lista reazioni per comunicazione
router.get('/', async (req, res) => {
  try {
    const { comunicazione_id } = req.query;
    
    if (!comunicazione_id) {
      return res.status(400).json({
        success: false,
        error: 'ID comunicazione richiesto'
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM reazioni_comunicazioni WHERE comunicazione_id = $1 ORDER BY data_reazione DESC',
      [comunicazione_id]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero reazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/reazioni-comunicazioni - Aggiungi reazione
router.post('/', async (req, res) => {
  try {
    const { comunicazione_id, user_id, tipo_reazione } = req.body;
    
    if (!comunicazione_id || !user_id || !tipo_reazione) {
      return res.status(400).json({
        success: false,
        error: 'ID comunicazione, ID utente e tipo reazione sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO reazioni_comunicazioni (comunicazione_id, user_id, tipo_reazione, data_reazione) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [comunicazione_id, user_id, tipo_reazione]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta reazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
