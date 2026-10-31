const express = require('express');
const { compressRegione, decompressRegione } = require('../utils/locationUtils');
const { getPool } = require('../config/database');
const { queryWithAccountModelFallback } = require('../services/accountCapabilitiesService');
const router = express.Router();
require('dotenv').config();

const pool = getPool();
const MODERN_ACTIVIST_FILTER = 'COALESCE(u.is_activist, FALSE) = TRUE';
const LEGACY_ACTIVIST_FILTER = "(u.ruolo = 'A' OR u.ruolo = 'AD')";

function queryActivists(sqlTemplate, values = []) {
  return queryWithAccountModelFallback(
    pool,
    sqlTemplate.replace('__ACCOUNT_FILTER__', MODERN_ACTIVIST_FILTER),
    sqlTemplate.replace('__ACCOUNT_FILTER__', LEGACY_ACTIVIST_FILTER),
    values
  );
}

// GET /api/attivisti - Lista tutti gli utenti con ruolo "Attivista"
router.get('/', async (req, res) => {
  try {
    const { search, regione, tipologia, exclude_user_id } = req.query;
    
    // Disabilita il caching per questo endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Filtri comuni; l'appartenenza Attivista deriva dalla capability canonica.
    let whereConditions = ['1=1'];
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
      if (regionCode) {
        whereConditions.push(`u.regione_residenza = $${paramIndex}`);
        queryParams.push(regionCode);
        paramIndex++;
      } else {
      }
    }

    // Filtro per tipologia di attivismo
    if (tipologia && tipologia.trim() && tipologia !== 'all') {
      // Cerca tipologie che contengono un elemento con tipo = tipologia
      whereConditions.push(`EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(u.tipologie_attivismo) AS elem
        WHERE elem->>'tipo' = $${paramIndex}
      )`);
      queryParams.push(tipologia.trim());
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
    const result = await queryActivists(`
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
        WHERE s.attivisti = u.id
      ) us ON TRUE
      WHERE __ACCOUNT_FILTER__ AND ${whereClause}
      ORDER BY supporters_count DESC, u.created_at DESC
    `, queryParams);
    
    const attivisti = result.rows;
    
    
    // One indexed read piggybacks on the directory response; no extra browser GET.
    // Public directory shows only approved IDs and titles: user-submitted details and source links are private to moderation.
    // Pending/rejected proposals and proposer identities are never exposed.
    const approvedSubjects = await pool.query(
      "SELECT id, title FROM subject_proposals WHERE status='approved' AND category=$1 ORDER BY reviewed_at DESC LIMIT 100",
      ['attivisti']
    );

    res.json({
      success: true,
      data: attivisti,
      approved_subjects: approvedSubjects.rows,
      count: attivisti.length,
      message: attivisti.length === 0 ? 'Al momento non ci sono attivisti registrati' : `${attivisti.length} attivisti trovati`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero degli attivisti:');
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
    
    // Disabilita il caching per questo endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Query per ottenere attivisti con una tipologia specifica
    const result = await queryActivists(`
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
      FROM users u
      WHERE __ACCOUNT_FILTER__
      AND tipologie_attivismo @> $1
      ORDER BY created_at DESC
    `, [JSON.stringify([{ tipo }])]);
    
    const attivisti = result.rows;
    
    
    res.json({
      success: true,
      data: attivisti,
      count: attivisti.length,
      tipologia: tipo,
      message: attivisti.length === 0 ? `Nessun attivista trovato per la tipologia "${tipo}"` : `${attivisti.length} attivisti trovati per la tipologia "${tipo}"`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero degli attivisti per tipologia:');
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
    
    // Query per contare attivisti per tipologia
    const result = await queryActivists(`
      SELECT 
        jsonb_array_elements(u.tipologie_attivismo)->>'tipo' as tipo,
        COUNT(*) as count
      FROM users u
      WHERE __ACCOUNT_FILTER__
      AND tipologie_attivismo IS NOT NULL
      AND jsonb_array_length(tipologie_attivismo) > 0
      GROUP BY tipo
      ORDER BY count DESC
    `);
    
    const statistiche = result.rows;
    
    // Query per contare attivisti totali
    const totalResult = await queryActivists(`
      SELECT COUNT(*) as total
      FROM users u
      WHERE __ACCOUNT_FILTER__
    `);
    
    const totalAttivisti = parseInt(totalResult.rows[0].total);
    
    
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
    console.error('❌ Errore nel calcolo delle statistiche:');
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
    
    // Ottieni regioni uniche (già compresse nel DB come "LO", "TO", etc.)
    const regioniResult = await queryActivists(`
      SELECT DISTINCT regione_residenza
      FROM users u
      WHERE __ACCOUNT_FILTER__
      AND regione_residenza IS NOT NULL 
      AND regione_residenza != ''
      ORDER BY regione_residenza
    `);
    
    // Decompressione regioni per il frontend (DB ha "LO" → "Lombardia" per mostrare nel dropdown)
    const regioni = regioniResult.rows
      .map(row => decompressRegione(row.regione_residenza))
      .filter(regione => regione) // Rimuove valori null
      .sort();
    
    // Ottieni tipologie uniche
    const tipologieResult = await queryActivists(`
      SELECT DISTINCT jsonb_array_elements(u.tipologie_attivismo)->>'tipo' as tipo
      FROM users u
      WHERE __ACCOUNT_FILTER__
      AND tipologie_attivismo IS NOT NULL
      AND jsonb_array_length(tipologie_attivismo) > 0
      ORDER BY tipo
    `);
    
    const tipologie = tipologieResult.rows.map(row => row.tipo);
    
    
    res.json({
      success: true,
      data: {
        regioni,
        tipologie
      },
      message: `Filtri disponibili: ${regioni.length} regioni, ${tipologie.length} tipologie`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero dei filtri:');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i filtri disponibili'
    });
  }
});

module.exports = router;
