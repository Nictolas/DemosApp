const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER GOVERNO =====

// GET /api/governo - Lista membri del governo
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM governo ORDER BY ruolo, cognome'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/governo/ideale - Governo ideale dell'utente
router.get('/ideale', async (req, res) => {
  try {
    console.log('🔍 GET /api/governo/ideale - Richiesta governo ideale');
    
    // Per ora restituiamo un governo ideale di esempio
    // In futuro potremmo recuperarlo dal database per utente specifico
    const governoIdeale = {
      presidente_consiglio: "Mario Rossi",
      ministro_interni: "Giulia Bianchi",
      ministro_esteri: "Luca Verdi",
      ministro_economia: "Anna Neri",
      ministro_giustizia: "Paolo Blu"
    };
    
    res.json({
      success: true,
      data: governoIdeale
    });
  } catch (error) {
    console.error('❌ Errore nel recupero governo ideale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/governo - Aggiungi membro governo
router.post('/', async (req, res) => {
  try {
    const { nome, cognome, ruolo, partito, data_nominazione } = req.body;
    
    if (!nome || !cognome || !ruolo) {
      return res.status(400).json({
        success: false,
        error: 'Nome, cognome e ruolo sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO governo (nome, cognome, ruolo, partito, data_nominazione) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, cognome, ruolo, partito, data_nominazione]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta membro governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
