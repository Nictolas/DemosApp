const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET /api/attivisti - Lista tutti gli utenti con ruolo "Attivista"
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/attivisti - Lista attivisti richiesta');
    
    // Query per ottenere tutti gli utenti con ruolo "Attivista"
    const result = await pool.query(`
      SELECT 
        id, 
        nome, 
        cognome, 
        email, 
        ruolo, 
        status, 
        created_at, 
        updated_at,
        avatar_config,
        genere,
        data_nascita,
        cittadinanza,
        paese_residenza,
        regione_residenza,
        provincia_residenza,
        comune_residenza
      FROM users 
      WHERE ruolo = 'Attivista'
      ORDER BY created_at DESC
    `);
    
    const attivisti = result.rows;
    
    console.log(`✅ Trovati ${attivisti.length} attivisti`);
    
    res.json({
      success: true,
      data: attivisti,
      count: attivisti.length,
      message: attivisti.length === 0 ? 'Al momento non ci sono attivisti registrati' : `${attivisti.length} attivisti trovati`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero degli attivisti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare la lista degli attivisti'
    });
  }
});

module.exports = router;
