const express = require('express');
const { compressRegione, decompressRegione } = require('../utils/locationUtils');
const { getPool } = require('../config/database');
const { queryWithAccountModelFallback } = require('../services/accountCapabilitiesService');
const { readApprovedPage } = require('../services/publicApprovedSubjectPage');
const { projectPublicDirectoryMembers } = require('../services/publicDirectoryMemberProjection');
const {decodeRegisteredCursor,pageRegistered} = require('../services/registeredDirectoryPage');
const router = express.Router();
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();
const MODERN_ORGANIZATION_FILTER = "u.account_type = 'ORGANIZATION'";
const LEGACY_ORGANIZATION_FILTER = "u.ruolo = 'O'";

function queryOrganizations(sqlTemplate, values = []) {
  return queryWithAccountModelFallback(
    pool,
    sqlTemplate.replace('__ACCOUNT_FILTER__', MODERN_ORGANIZATION_FILTER),
    sqlTemplate.replace('__ACCOUNT_FILTER__', LEGACY_ORGANIZATION_FILTER),
    values
  );
}

// GET /api/organizzazioni - Lista tutti gli utenti con ruolo "Organizzazione"
router.get('/', async (req, res) => {
  try {
    const { search, regione, tipologia, exclude_user_id } = req.query;
    const membersCursor = decodeRegisteredCursor(req.query.members_cursor);
    if (membersCursor === false) return res.status(400).json({success:false,error:'Cursore non valido'});
    
    // Disabilita il caching per questo endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Filtri comuni; il tipo Organizzazione deriva dall'account type canonico.
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

    // Filtro per tipologia di attivismo (le organizzazioni possono avere tipologie)
    if (tipologia && tipologia.trim() && tipologia !== 'all') {
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

    // Return at most 100 profiles, then advance by the same stable sort keys.
    if (membersCursor) {
      const n=queryParams.length+1;
      whereConditions.push(`(COALESCE(us.cnt,0)::int, u.created_at, u.id::text) < ($${n}::int, (SELECT cursor_user.created_at FROM users cursor_user WHERE cursor_user.id=$${n+1}::uuid), $${n+1}::text)`);
      queryParams.push(...membersCursor);
    }
    const whereClause = whereConditions.join(' AND ');


    // Query per ottenere tutti gli utenti con ruolo "Organizzazione" con conteggio voti e ordinati
    const result = await queryOrganizations(`
      SELECT
        u.id,
        u.nome,
        u.cognome,
        u.ruolo,
        u.avatar_config,
        u.regione_residenza,
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
      WHERE __ACCOUNT_FILTER__ AND ${whereClause}
      ORDER BY supporters_count DESC, u.created_at DESC, u.id::text DESC LIMIT 101
    `, queryParams);
    
    const {rows:organizzazioni,members_next_cursor} = pageRegistered(result.rows);
    
    
    // One indexed read piggybacks on the directory response; no extra browser GET.
    // Public directory shows only approved IDs and titles: user-submitted details and source links are private to moderation.
    // Pending/rejected proposals and proposer identities are never exposed.
    const approvedPage = membersCursor ? {data:[],next_cursor:null} : await readApprovedPage(pool, 'organizzazioni');

    res.json({
      success: true,
      data: projectPublicDirectoryMembers(organizzazioni),
      approved_subjects: approvedPage.data,
      approved_next_cursor: approvedPage.next_cursor,
      members_next_cursor,
      count: organizzazioni.length,
      message: organizzazioni.length === 0 ? 'Al momento non ci sono organizzazioni registrate' : `${organizzazioni.length} organizzazioni trovate`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero delle organizzazioni:');
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
    
    // Ottieni regioni uniche e decompresse per il frontend
    const regioniResult = await queryOrganizations(`
      SELECT DISTINCT regione_residenza
      FROM users u
      WHERE __ACCOUNT_FILTER__
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
    const tipologieResult = await queryOrganizations(`
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

