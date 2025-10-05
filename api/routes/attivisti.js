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
    
    // Disabilita il caching per questo endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
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
              comune_residenza,
              facebook_url,
              twitter_url,
              instagram_url,
              linkedin_url,
              telegram_url,
              website_url,
              twitch_url,
              youtube_url,
              tipologie_attivismo
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

// GET /api/attivisti/tipologia/:tipo - Lista attivisti per tipologia specifica
router.get('/tipologia/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    console.log(`🔍 GET /api/attivisti/tipologia/${tipo} - Lista attivisti per tipologia`);
    
    // Disabilita il caching per questo endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Query per ottenere attivisti con una tipologia specifica
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
        comune_residenza,
        facebook_url,
        twitter_url,
        instagram_url,
        linkedin_url,
        telegram_url,
        website_url,
        twitch_url,
        youtube_url,
        tipologie_attivismo
      FROM users
      WHERE ruolo = 'Attivista'
      AND tipologie_attivismo @> $1
      ORDER BY created_at DESC
    `, [JSON.stringify([{ tipo }])]);
    
    const attivisti = result.rows;
    
    console.log(`✅ Trovati ${attivisti.length} attivisti per tipologia "${tipo}"`);
    
    res.json({
      success: true,
      data: attivisti,
      count: attivisti.length,
      tipologia: tipo,
      message: attivisti.length === 0 ? `Nessun attivista trovato per la tipologia "${tipo}"` : `${attivisti.length} attivisti trovati per la tipologia "${tipo}"`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero degli attivisti per tipologia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare la lista degli attivisti per tipologia'
    });
  }
});

// GET /api/attivisti/statistiche - Statistiche per tipologie di attivismo
router.get('/statistiche', async (req, res) => {
  try {
    console.log('📊 GET /api/attivisti/statistiche - Statistiche tipologie attivismo');
    
    // Query per contare attivisti per tipologia
    const result = await pool.query(`
      SELECT 
        jsonb_array_elements(tipologie_attivismo)->>'tipo' as tipo,
        COUNT(*) as count
      FROM users 
      WHERE ruolo = 'Attivista'
      AND tipologie_attivismo IS NOT NULL
      AND jsonb_array_length(tipologie_attivismo) > 0
      GROUP BY tipo
      ORDER BY count DESC
    `);
    
    const statistiche = result.rows;
    
    // Query per contare attivisti totali
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM users 
      WHERE ruolo = 'Attivista'
    `);
    
    const totalAttivisti = parseInt(totalResult.rows[0].total);
    
    console.log(`📊 Statistiche calcolate: ${statistiche.length} tipologie, ${totalAttivisti} attivisti totali`);
    
    res.json({
      success: true,
      data: {
        statistiche,
        totalAttivisti,
        totalTipologie: statistiche.length
      },
      message: `Statistiche per ${statistiche.length} tipologie di attivismo`
    });
    
  } catch (error) {
    console.error('❌ Errore nel calcolo delle statistiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile calcolare le statistiche delle tipologie'
    });
  }
});

module.exports = router;
