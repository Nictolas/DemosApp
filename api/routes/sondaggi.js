const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');
const { compressRegione, compressProvince, decompressRegione, decompressProvince } = require('../utils/locationUtils');
const { decompressGender } = require('../utils/genderUtils');
const { MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE: minimumCellSize, cellThresholdMet } = require('../utils/politicalAggregatePrivacy');
const { getNationalSurveyStats, getTerritorialSurveyStats } = require('../utils/sondaggiTextBulk');

const { getAllOpinions, sortOpinionsByText } = require('../services/opinionCatalog');

const router = express.Router();

// GET /api/sondaggi - Ottieni tutti i sondaggi (opinioni aggregate)
router.get('/', async (req, res) => {
  try {
    const opinioni = sortOpinionsByText(getAllOpinions()).map(({ id, text }) => ({ id, text }));
    
    // Aggregate the published, schema-validated TEXT opinion columns in one
    // query. Preserve the legacy {stats, questions} payload, explicit
    // consent/PERSON filters and minimum 10-person disclosure threshold.
    // The helper falls back to per-opinion reads if aggregation is unavailable.
    const questions = opinioni.map(({ id, text }) => ({ id, text }));
    const stats = await getNationalSurveyStats(pool, opinioni);

    res.json({
      success: true,
      data: {
        stats,
        questions
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi'
    });
  }
});

// GET /api/sondaggi/stats - Statistiche generali
router.get('/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN status = 'A' OR status = 'a' THEN 1 END) as utenti_attivi,
        COUNT(CASE WHEN status = 'P' OR status = 'p' THEN 1 END) as utenti_in_attesa
      FROM users
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche sondaggi'
    });
  }
});

// GET /api/sondaggi/genere - Statistiche per genere
router.get('/genere', async (req, res) => {
  try {
    const query = `
      SELECT 
        genere,
        COUNT(*) as totale
      FROM users 
      WHERE genere IS NOT NULL
      GROUP BY genere
      ORDER BY totale DESC
    `;
    
    const result = await pool.query(query);
    
    // Decomprimi i generi per il frontend
    const decompressedStats = result.rows.map(row => ({
      ...row,
      genere: decompressGender(row.genere) || row.genere
    }));
    
    res.json({
      success: true,
      stats: decompressedStats
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere'
    });
  }
});

// GET /api/sondaggi/genere/:regione - Statistiche per genere per regione
router.get('/genere/:regione', async (req, res) => {
  try {
    const { regione } = req.params;
    
    // Converte slug in nome regione (es. "toscana" -> "Toscana")
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    
    // Converte nome regione in codice per la query database
    const regionCode = compressRegione(regionName);
    
    if (!regionCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione non valida'
      });
    }
    
    const query = `
      SELECT 
        genere,
        COUNT(*) as totale
      FROM users 
      WHERE genere IS NOT NULL 
      AND regione_residenza = $1
      GROUP BY genere
      ORDER BY totale DESC
    `;
    
    const result = await pool.query(query, [regionCode]);
    
    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere per regione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere per regione'
    });
  }
});

// GET /api/sondaggi/genere/:regione/:provincia - Statistiche per genere per provincia
router.get('/genere/:regione/:provincia', async (req, res) => {
  try {
    const { regione, provincia } = req.params;
    
    // Converte slug in nome regione e provincia
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    const provinciaName = provincia.charAt(0).toUpperCase() + provincia.slice(1).replace(/-/g, ' ');
    
    // Converte nomi in codici per la query database
    const regionCode = compressRegione(regionName);
    const provinciaCode = compressProvince(provinciaName);
    
    if (!regionCode || !provinciaCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione o provincia non valida'
      });
    }
    
    const query = `
      SELECT 
        genere,
        COUNT(*) as totale
      FROM users 
      WHERE genere IS NOT NULL 
      AND regione_residenza = $1
      AND provincia_residenza = $2
      GROUP BY genere
      ORDER BY totale DESC
    `;
    
    const result = await pool.query(query, [regionCode, provinciaCode]);
    
    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere per provincia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere per provincia'
    });
  }
});

// GET /api/sondaggi/genere/:regione/:provincia/:comune - Statistiche per genere per comune
router.get('/genere/:regione/:provincia/:comune', async (req, res) => {
  try {
    const { regione, provincia, comune } = req.params;
    
    // Converte slug in nome regione, provincia e comune
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    const provinciaName = provincia.charAt(0).toUpperCase() + provincia.slice(1).replace(/-/g, ' ');
    const comuneName = comune.charAt(0).toUpperCase() + comune.slice(1).replace(/-/g, ' ');
    
    // Converte nomi in codici per la query database
    const regionCode = compressRegione(regionName);
    const provinciaCode = compressProvince(provinciaName);
    
    if (!regionCode || !provinciaCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione o provincia non valida'
      });
    }
    
    const query = `
      SELECT 
        genere,
        COUNT(*) as totale
      FROM users 
      WHERE genere IS NOT NULL 
      AND regione_residenza = $1
      AND provincia_residenza = $2
      AND comune_residenza = $3
      GROUP BY genere
      ORDER BY totale DESC
    `;
    
    const result = await pool.query(query, [regionCode, provinciaCode, comuneName]);
    
    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere per comune:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere per comune'
    });
  }
});

// GET /api/sondaggi/:regione - Statistiche per regione
router.get('/:regione', async (req, res) => {
  try {
    const { regione } = req.params;
    
    // Converte slug in nome regione (es. "toscana" -> "Toscana")
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    
    // Converte nome regione in codice per la query database
    const regionCode = compressRegione(regionName);
    
    if (!regionCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione non valida'
      });
    }
    
    const opinioni = sortOpinionsByText(getAllOpinions()).map(({ id, text }) => ({ id, text }));
    
    // One published-question catalog query, one schema whitelist query and
    // one grouped TEXT query. Preserve consent, PERSON and privacy >=10.
    // A grouped-query failure falls back to the prior per-opinion semantics.
    const questions = opinioni.map(({ id, text }) => ({ id, text }));
    const stats = await getTerritorialSurveyStats(pool, opinioni, {
      scope: 'regione', params: [regionCode]
    });

    res.json({
      success: true,
      data: {
        stats,
        questions,
        filter: {
          type: 'regione',
          value: regionName
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi regionali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi regionali'
    });
  }
});

// GET /api/sondaggi/:regione/:provincia - Statistiche per provincia
router.get('/:regione/:provincia', async (req, res) => {
  try {
    const { regione, provincia } = req.params;
    
    // Converte slug in nome regione e provincia
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    const provinciaName = provincia.charAt(0).toUpperCase() + provincia.slice(1).replace(/-/g, ' ');
    
    // Converte nomi in codici per la query database
    const regionCode = compressRegione(regionName);
    const provinciaCode = compressProvince(provinciaName);
    
    if (!regionCode || !provinciaCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione o provincia non valida'
      });
    }
    
    const opinioni = sortOpinionsByText(getAllOpinions()).map(({ id, text }) => ({ id, text }));
    
    // One published-question catalog query, one schema whitelist query and
    // one grouped TEXT query. Preserve consent, PERSON and privacy >=10.
    // A grouped-query failure falls back to the prior per-opinion semantics.
    const questions = opinioni.map(({ id, text }) => ({ id, text }));
    const stats = await getTerritorialSurveyStats(pool, opinioni, {
      scope: 'provincia', params: [regionCode, provinciaCode]
    });

    res.json({
      success: true,
      data: {
        stats,
        questions,
        filter: {
          type: 'provincia',
          value: provinciaName,
          regione: regionName,
          provincia: provinciaName
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi provinciali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi provinciali'
    });
  }
});

// GET /api/sondaggi/:regione/:provincia/:comune - Statistiche per comune
router.get('/:regione/:provincia/:comune', async (req, res) => {
  try {
    const { regione, provincia, comune } = req.params;
    
    // Converte slug in nome regione, provincia e comune
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    const provinciaName = provincia.charAt(0).toUpperCase() + provincia.slice(1).replace(/-/g, ' ');
    const comuneName = comune.charAt(0).toUpperCase() + comune.slice(1).replace(/-/g, ' ');
    
    // Converte nomi in codici per la query database
    const regionCode = compressRegione(regionName);
    const provinciaCode = compressProvince(provinciaName);
    
    if (!regionCode || !provinciaCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione o provincia non valida'
      });
    }
    
    const opinioni = sortOpinionsByText(getAllOpinions()).map(({ id, text }) => ({ id, text }));
    
    // One published-question catalog query, one schema whitelist query and
    // one grouped TEXT query. Preserve consent, PERSON and privacy >=10.
    // A grouped-query failure falls back to the prior per-opinion semantics.
    const questions = opinioni.map(({ id, text }) => ({ id, text }));
    const stats = await getTerritorialSurveyStats(pool, opinioni, {
      scope: 'comune', params: [regionCode, provinciaCode, comuneName]
    });

    res.json({
      success: true,
      data: {
        stats,
        questions,
        filter: {
          type: 'comune',
          value: comuneName,
          regione: regionName,
          provincia: provinciaName,
          comune: comuneName
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi comunali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi comunali'
    });
  }
});

module.exports = router;
