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
    console.log('🔍 GET /api/eventi - Richiesta eventi');
    
    // Prima controlliamo se la tabella esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'eventi'
      );
    `);
    
    console.log('📋 Tabella eventi esiste:', tableExists.rows[0].exists);
    
    if (!tableExists.rows[0].exists) {
      return res.json({
        success: true,
        data: [],
        message: 'Tabella eventi non trovata'
      });
    }
    
    const result = await pool.query(
      'SELECT id, nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, orario_evento, organizzatore, created_at FROM eventi ORDER BY created_at ASC'
    );
    
    console.log('📊 Eventi trovati:', result.rows.length);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero eventi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
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
