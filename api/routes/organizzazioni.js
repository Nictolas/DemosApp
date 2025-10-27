const express = require('express');
const { Pool } = require('pg');
const { compressRegione, decompressRegione } = require('../utils/locationUtils');
const router = express.Router();
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET /api/organizzazioni - Lista tutti gli utenti con ruolo "Organizzazione"
router.get('/', async (req, res) => {
  try {
    const { search, regione, tipologia, exclude_user_id } = req.query;
    console.log('🔍 GET /api/organizzazioni - Lista organizzazioni richiesta', { search, regione, tipologia, exclude_user_id });
    
    // Disabilita il caching per questo endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Costruisci la query con filtri dinamici
    // Mostra Organizzazioni (ruolo O)
    let whereConditions = [
      "u.ruolo = 'O'"
    ];
    let queryParams = [];
    let paramIndex = 1;

    // Filtro per ricerca testuale (nome/cognome)
    if (search && search.trim()) {
      whereConditions.push(`(
        LOWER(u.nome) LIKE LOWER($${paramIndex}) OR 
        LOWER(u.cognome) LIKE LOWER($${paramIndex}) OR
        LOWER(CONCAT(u.nome, ' ', u.cognome)) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Filtro per regione
    if (regione && regione.trim() && regione !== 'all') {
      // Converte nome regione in codice per la query database
      const regionCode = compressRegione(regione.trim());
      console.log('🔍 Filtro regione:', { regione, regionCode });
      if (regionCode) {
        whereConditions.push(`u.regione_residenza = $${paramIndex}`);
        queryParams.push(regionCode);
        paramIndex++;
      } else {
        console.log('⚠️ Regione non riconosciuta o non trovata:', regione);
      }
    }

    // Filtro per tipologia di attivismo (le organizzazioni possono avere tipologie)
    if (tipologia && tipologia.trim() && tipologia !== 'all') {
      console.log('🔍 Filtro tipologia:', tipologia);
      whereConditions.push(`u.tipologie_attivismo @> $${paramIndex}`);
      queryParams.push(JSON.stringify([{ tipo: tipologia.trim() }]));
      paramIndex++;
    }

    // Filtro per escludere utente corrente
    if (exclude_user_id && exclude_user_id.trim()) {
      whereConditions.push(`u.id != $${paramIndex}`);
      queryParams.push(exclude_user_id.trim());
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Log per debug
    console.log('🔍 Query params:', { 
      whereConditions, 
      queryParams, 
      whereClause 
    });

    // Query per ottenere tutti gli utenti con ruolo "Organizzazione" con conteggio voti e ordinati
    const result = await pool.query(`
      SELECT
        u.id,
        u.nome,
        u.cognome,
        u.email,
        u.ruolo,
        u.status,
        u.created_at,
        u.updated_at,
        u.avatar_config,
        u.genere,
        u.data_nascita,
        u.cittadinanza,
        u.paese_residenza,
        u.regione_residenza,
        u.provincia_residenza,
        u.comune_residenza,
        u.facebook_url,
        u.twitter_url,
        u.instagram_url,
        u.linkedin_url,
        u.telegram_url,
        u.website_url,
        u.twitch_url,
        u.youtube_url,
        u.tipologie_attivismo,
        COALESCE(us.cnt, 0)::int AS supporters_count
      FROM users u
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM users s
        WHERE s.organizzazioni = u.id
      ) us ON TRUE
      WHERE ${whereClause}
      ORDER BY supporters_count DESC, u.created_at DESC
    `, queryParams);
    
    const organizzazioni = result.rows;
    
    console.log(`✅ Trovate ${organizzazioni.length} organizzazioni`);
    
    res.json({
      success: true,
      data: organizzazioni,
      count: organizzazioni.length,
      message: organizzazioni.length === 0 ? 'Al momento non ci sono organizzazioni registrate' : `${organizzazioni.length} organizzazioni trovate`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero delle organizzazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare la lista delle organizzazioni'
    });
  }
});

// GET /api/organizzazioni/filtri - Ottieni regioni e tipologie disponibili per i filtri
router.get('/filtri', async (req, res) => {
  try {
    console.log('🔍 GET /api/organizzazioni/filtri - Filtri disponibili richiesti');
    
    // Ottieni regioni uniche e decompresse per il frontend
    const regioniResult = await pool.query(`
      SELECT DISTINCT regione_residenza
      FROM users 
      WHERE ruolo = 'O' 
      AND regione_residenza IS NOT NULL 
      AND regione_residenza != ''
      ORDER BY regione_residenza
    `);
    
    // Decompressione regioni per il frontend
    const regioni = regioniResult.rows
      .map(row => decompressRegione(row.regione_residenza))
      .filter(regione => regione) // Rimuove valori null
      .sort();
    
    // Ottieni tipologie uniche
    const tipologieResult = await pool.query(`
      SELECT DISTINCT jsonb_array_elements(tipologie_attivismo)->>'tipo' as tipo
      FROM users 
      WHERE ruolo = 'O'
      AND tipologie_attivismo IS NOT NULL
      AND jsonb_array_length(tipologie_attivismo) > 0
      ORDER BY tipo
    `);
    
    const tipologie = tipologieResult.rows.map(row => row.tipo);
    
    console.log(`✅ Filtri disponibili: ${regioni.length} regioni, ${tipologie.length} tipologie`);
    console.log('📍 Regioni disponibili:', regioni);
    console.log('🎯 Tipologie disponibili:', tipologie);
    
    res.json({
      success: true,
      data: {
        regioni,
        tipologie
      },
      message: `Filtri disponibili: ${regioni.length} regioni, ${tipologie.length} tipologie`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero dei filtri:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i filtri disponibili'
    });
  }
});

module.exports = router;

