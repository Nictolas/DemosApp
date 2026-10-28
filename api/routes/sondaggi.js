const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');
const { compressRegione, compressProvince, decompressRegione, decompressProvince } = require('../utils/locationUtils');
const { MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE: minimumCellSize, cellThresholdMet } = require('../utils/politicalAggregatePrivacy');
const { getNationalSurveyStats, getTerritorialSurveyStats } = require('../utils/sondaggiTextBulk');
const { protectSexCountRows } = require('../utils/canonicalSexAggregate');

const router = express.Router();

// GET /api/sondaggi - Ottieni tutti i sondaggi (opinioni aggregate)
router.get('/', async (req, res) => {
  try {
    // 1. Prima recupera le domande dalla tabella opinioni (escludendo quelle "da approvare")
    const questionsQuery = `
      SELECT id, text
      FROM opinioni_domande 
      WHERE NOT ('da approvare' = ANY(gradi_opinione))
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
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

// Statistiche M/F registrate, inclusi dati storici o inferiti: non necessariamente CIE.
// Gli endpoint legacy /genere restano temporaneamente raggiungibili, ma non
// ripubblicano il genere legacy e non etichettano M/F come identita' di genere.
const sexStatsPaths = [
  '/sesso',
  '/sesso/:regione',
  '/sesso/:regione/:provincia',
  '/sesso/:regione/:provincia/:comune'
];

async function serveCanonicalSexStats(req, res) {
  try {
    const { regione, provincia, comune } = req.params;
    const where = [
      "account_type = 'PERSON'",
      "sesso IN ('M','F')"
    ];
    const params = [];
    if (regione) {
      const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
      const regionCode = compressRegione(regionName);
      if (!regionCode) return res.status(400).json({ success: false, error: 'Regione non valida' });
      params.push(regionCode);
      where.push(`regione_residenza = $${params.length}`);
    }
    if (provincia) {
      const provinciaName = provincia.charAt(0).toUpperCase() + provincia.slice(1).replace(/-/g, ' ');
      const provinciaCode = compressProvince(provinciaName);
      if (!provinciaCode) return res.status(400).json({ success: false, error: 'Provincia non valida' });
      params.push(provinciaCode);
      where.push(`provincia_residenza = $${params.length}`);
    }
    if (comune) {
      const comuneName = comune.charAt(0).toUpperCase() + comune.slice(1).replace(/-/g, ' ');
      params.push(comuneName);
      where.push(`comune_residenza = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT sesso, COUNT(*)::int AS totale FROM users
       WHERE ${where.join(' AND ')}
       GROUP BY sesso ORDER BY sesso`,
      params
    );
    // Fail closed: se un sesso ha 1-9 persone, il dettaglio e' completamente
    // nascosto anche per evitare ricostruzioni per sottrazione.
    const protectedStats = protectSexCountRows(result.rows, minimumCellSize);
    return res.json({
      success: true,
      minimumCellSize,
      suppressed: protectedStats.suppressed,
      stats: protectedStats.data
    });
  } catch (error) {
    console.error('Errore statistiche sesso aggregate:', error);
    return res.status(500).json({ success: false, error: 'Statistiche non disponibili' });
  }
}

sexStatsPaths.forEach(route => router.get(route, serveCanonicalSexStats));

// Compatibilita' per client storici: manteniamo la forma {stats: []} ma
// non forniamo dati di genere legacy o sesso sotto etichetta errata.
[
  '/genere',
  '/genere/:regione',
  '/genere/:regione/:provincia',
  '/genere/:regione/:provincia/:comune'
].forEach(route => router.get(route, (_req, res) => {
  res.set('Deprecation', 'true');
  res.json({ success: true, deprecated: true, stats: [] });
}));

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
    
    // 1. Prima recupera le domande dalla tabella opinioni (escludendo quelle "da approvare")
    const questionsQuery = `
      SELECT id, text
      FROM opinioni_domande 
      WHERE NOT ('da approvare' = ANY(gradi_opinione))
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
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
    
    // 1. Prima recupera le domande dalla tabella opinioni (escludendo quelle "da approvare")
    const questionsQuery = `
      SELECT id, text
      FROM opinioni_domande 
      WHERE NOT ('da approvare' = ANY(gradi_opinione))
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
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
    
    // 1. Prima recupera le domande dalla tabella opinioni (escludendo quelle "da approvare")
    const questionsQuery = `
      SELECT id, text
      FROM opinioni_domande 
      WHERE NOT ('da approvare' = ANY(gradi_opinione))
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
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
