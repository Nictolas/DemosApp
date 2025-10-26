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

// GET /api/attivisti - Lista tutti gli utenti con ruolo "Attivista"
router.get('/', async (req, res) => {
  try {
    const { search, regione, tipologia, exclude_user_id } = req.query;
    console.log('🔍 GET /api/attivisti - Lista attivisti richiesta', { search, regione, tipologia, exclude_user_id });
    
    // Disabilita il caching per questo endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Costruisci la query con filtri dinamici
    // Mostra Attivisti e Admin (semplificato per includere tutti gli Admin)
    let whereConditions = [
      "(u.ruolo = 'A' OR u.ruolo = 'AD')"
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
    if (regione && regione.trim()) {
      // Converte nome regione in codice per la query database
      const regionCode = compressRegione(regione.trim());
      if (regionCode) {
        whereConditions.push(`u.regione_residenza = $${paramIndex}`);
        queryParams.push(regionCode);
        paramIndex++;
      }
    }

    // Filtro per tipologia di attivismo
    if (tipologia && tipologia.trim()) {
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

    // Query per ottenere tutti gli utenti con ruolo "Attivista" con conteggio voti e ordinati
    const result = await pool.query(`
      SELECT
        u.id,
        u.codice_attivista,
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
        WHERE s.rappresentante_europeo::text = u.id::text
           OR s.rappresentante_camera::text = u.id::text
           OR s.rappresentante_senato::text = u.id::text
           OR s.rappresentante_regionale::text = u.id::text
           OR s.rappresentante_comune::text = u.id::text
      ) us ON TRUE
      WHERE ${whereClause}
      ORDER BY supporters_count DESC, u.created_at DESC
    `, queryParams);
    
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
      WHERE ruolo = 'A'
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
      WHERE ruolo = 'A'
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
      WHERE ruolo = 'A'
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

// GET /api/attivisti/filtri - Ottieni regioni e tipologie disponibili per i filtri
router.get('/filtri', async (req, res) => {
  try {
    console.log('🔍 GET /api/attivisti/filtri - Filtri disponibili richiesti');
    
    // Ottieni regioni uniche e decompressi per il frontend
    const regioniResult = await pool.query(`
      SELECT DISTINCT regione_residenza
      FROM users 
      WHERE ruolo = 'A' 
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
      WHERE ruolo = 'A'
      AND tipologie_attivismo IS NOT NULL
      AND jsonb_array_length(tipologie_attivismo) > 0
      ORDER BY tipo
    `);
    
    const tipologie = tipologieResult.rows.map(row => row.tipo);
    
    console.log(`✅ Filtri disponibili: ${regioni.length} regioni, ${tipologie.length} tipologie`);
    
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

// Importa le route per la votazione
const voteRouter = require('./attivisti-vote');

// Usa le route di votazione
router.use('/', voteRouter);

module.exports = router;
