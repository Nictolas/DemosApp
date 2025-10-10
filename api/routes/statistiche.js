const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER STATISTICHE =====

// GET /api/statistiche/utenti - Statistiche utenti
router.get('/utenti', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as utenti_verificati,
        COUNT(CASE WHEN ruolo = 'admin' THEN 1 END) as admin
      FROM users
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/statistiche/opinioni - Statistiche opinioni
router.get('/opinioni', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as totale_opinioni,
        COUNT(*) as opinioni_approvate
      FROM opinioni
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
