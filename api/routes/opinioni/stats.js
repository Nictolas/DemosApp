const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const { compressRegione, decompressRegione } = require('../../utils/locationUtils');
const { decompressGender } = require('../../utils/genderUtils');
const {
  MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE: minimumCellSize,
  cellThresholdMet,
  suppressSmallCells
} = require('../../utils/politicalAggregatePrivacy');

const { getAllOpinions, getOpinionById } = require('../../services/opinionCatalog');

const router = express.Router();
const { resolvePublishedOpinionColumn } = require('../../utils/opinionStatsColumns');

// GET /api/opinioni/candidati - Endpoint di test senza autenticazione
router.get('/candidati', async (req, res) => {
  try {
    console.log('🧪 TEST - Endpoint opinioni raggiunto senza autenticazione');
    
    res.json({
      success: true,
      message: 'Endpoint opinioni raggiunto correttamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore endpoint test:');
    res.status(500).json({
      success: false,
      error: 'Errore endpoint test'
    });
  }
});

// GET /api/opinioni/debug - Debug completo opinioni
router.get('/debug', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 DEBUG - Richiesta debug opinioni');
    
    // 1. Verifica struttura tabella opinioni
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    // The official catalog no longer comes from PostgreSQL.
    const official = getAllOpinions();
    const countResult = {rows:[{total:String(official.length)}]};
    const grades = [...new Set(official.flatMap(op=>op.gradi_opinione))].sort();
    const degreesResult = {rows:grades.map(grado=>({grado}))};
    const sampleResult = {rows:official.slice(0,5).map(({id,text,gradi_opinione})=>({id,text,gradi_opinione}))};

    res.json({
      success: true,
      debug: {
        timestamp: new Date().toISOString(),
        tableStructure: structureResult.rows,
        totalOpinions: countResult.rows[0].total,
        availableDegrees: degreesResult.rows.map(r => r.grado),
        sampleOpinions: sampleResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel debug opinioni:');
    res.status(500).json({
      success: false,
      error: 'Errore nel debug opinioni',
      message: 'Errore interno del server'
    });
  }
});

// GET /api/opinioni/stats/:opinionId - Ottieni statistiche per opinione
router.get('/stats/:opinionId', async (req, res) => {
  try {
    const { opinionId } = req.params;
    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - opinionId ricevuto:', opinionId);
    
    // Accetta tutte e sole le opinioni ufficiali che hanno una colonna di risposta.
    const columnName = await resolvePublishedOpinionColumn(pool, opinionId);
    if (!columnName) {
      console.log('❌ DEBUG /api/opinioni/stats/:opinionId - OpinionId non mappato:', opinionId);
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - columnName mappato:', columnName);

    // Query per ottenere le statistiche dalla tabella opinioni_risposte
    const statsQuery = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.account_type IN ('PERSON', 'P')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
    `;
    
    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - Eseguendo query SQL...');
    const statsResult = await pool.query(statsQuery);
    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - Query eseguita con successo, righe:', statsResult.rows.length);
    const stats = statsResult.rows[0];
    
    const questionText = getOpinionById(opinionId)?.text || opinionId;
    
    const totaleUtenti = parseInt(stats.totale_utenti) || 0;
    const favorevole = parseInt(stats.favorevole) || 0;
    const contrario = parseInt(stats.contrario) || 0;
    const indeciso = parseInt(stats.indeciso) || 0;
    
    if (!cellThresholdMet({ favorevole, contrario, indeciso })) {
      return res.json({
        success: true,
        data: { suppressed: true, minimumCellSize, questionText }
      });
    }

    res.json({
      success: true,
      data: {
        suppressed: false,
        minimumCellSize,
        stats: { favorevole, contrario, indeciso },
        questionText,
        totaleUtenti
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche opinione:');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche opinione',
      message: 'Errore interno del server'
    });
  }
});

// GET /api/opinioni/stats/:opinionId/eta - Ottieni statistiche per età per opinione
router.get('/stats/:opinionId/eta', async (req, res) => {
  try {
    const { opinionId } = req.params;
    
    // Accetta tutte e sole le opinioni ufficiali che hanno una colonna di risposta.
    const columnName = await resolvePublishedOpinionColumn(pool, opinionId);
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per età dalla tabella opinioni_risposte
    const etaQuery = `
      WITH eta_groups AS (
        SELECT 
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) < 18 THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 18 AND 25 THEN '18-25'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 26 AND 35 THEN '26-35'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 36 AND 45 THEN '36-45'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 46 AND 55 THEN '46-55'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 56 AND 65 THEN '56-65'
            ELSE '65+'
          END as fascia_eta,
          orr.${columnName} as opinione_valore
        FROM opinioni_risposte orr
        JOIN users u ON u.id = orr.user_id
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE orr.${columnName} IS NOT NULL
        AND u.account_type IN ('PERSON', 'P')
        AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
        AND u.data_nascita IS NOT NULL
      )
      SELECT 
        fascia_eta,
        COUNT(CASE WHEN opinione_valore = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN opinione_valore = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN opinione_valore = 'i' THEN 1 END) as indeciso
      FROM eta_groups
      GROUP BY fascia_eta
      ORDER BY 
        CASE fascia_eta
          WHEN 'Under 18' THEN 1
          WHEN '18-25' THEN 2
          WHEN '26-35' THEN 3
          WHEN '36-45' THEN 4
          WHEN '46-55' THEN 5
          WHEN '56-65' THEN 6
          WHEN '65+' THEN 7
        END
    `;
    
    const etaResult = await pool.query(etaQuery);
    
    res.json({
      success: true,
      minimumCellSize,
      data: suppressSmallCells(etaResult.rows)
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche età opinione:');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche età opinione',
      message: 'Errore interno del server'
    });
  }
});

// GET /api/opinioni/stats/:opinionId/genere - Ottieni statistiche per genere per opinione
router.get('/stats/:opinionId/genere', async (req, res) => {
  try {
    const { opinionId } = req.params;
    
    // Accetta tutte e sole le opinioni ufficiali che hanno una colonna di risposta.
    const columnName = await resolvePublishedOpinionColumn(pool, opinionId);
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per genere dalla tabella opinioni_risposte
    const genereQuery = `
      SELECT 
        u.genere,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.account_type IN ('PERSON', 'P')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE 
      AND u.genere IS NOT NULL
      GROUP BY u.genere
      ORDER BY u.genere
    `;
    
    const genereResult = await pool.query(genereQuery);
    
    // Decomprimi i generi per il frontend
    const decompressedData = genereResult.rows.map(row => ({
      ...row,
      genere: decompressGender(row.genere) || row.genere
    }));
    
    res.json({
      success: true,
      minimumCellSize,
      data: suppressSmallCells(decompressedData)
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere opinione:');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere opinione',
      message: 'Errore interno del server'
    });
  }
});

// GET /api/opinioni/stats/:opinionId/regione/:regione - Ottieni statistiche per regione per opinione
router.get('/stats/:opinionId/regione/:regione', async (req, res) => {
  try {
    const { opinionId, regione } = req.params;
    
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
    
    // Accetta tutte e sole le opinioni ufficiali che hanno una colonna di risposta.
    const columnName = await resolvePublishedOpinionColumn(pool, opinionId);
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche dalla tabella opinioni_risposte per la regione specifica
    const statsQuery = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.account_type IN ('PERSON', 'P')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
      AND u.regione_residenza = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [regionCode]);
    const stats = statsResult.rows[0];
    
    const questionText = getOpinionById(opinionId)?.text || opinionId;
    
    const totaleUtenti = parseInt(stats.totale_utenti) || 0;
    const favorevole = parseInt(stats.favorevole) || 0;
    const contrario = parseInt(stats.contrario) || 0;
    const indeciso = parseInt(stats.indeciso) || 0;
    
    if (!cellThresholdMet({ favorevole, contrario, indeciso })) {
      return res.json({
        success: true,
        data: { suppressed: true, minimumCellSize, questionText, regione: regionName }
      });
    }

    res.json({
      success: true,
      data: {
        suppressed: false,
        minimumCellSize,
        stats: { favorevole, contrario, indeciso },
        questionText,
        totaleUtenti,
        regione: regionName
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche opinione regionale:');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche opinione regionale',
      message: 'Errore interno del server'
    });
  }
});

// GET /api/opinioni/stats/:opinionId/eta/regione/:regione - Ottieni statistiche per età per regione per opinione
router.get('/stats/:opinionId/eta/regione/:regione', async (req, res) => {
  try {
    const { opinionId, regione } = req.params;
    
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
    
    // Accetta tutte e sole le opinioni ufficiali che hanno una colonna di risposta.
    const columnName = await resolvePublishedOpinionColumn(pool, opinionId);
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per età dalla tabella opinioni_risposte per la regione specifica
    const etaQuery = `
      WITH eta_groups AS (
        SELECT 
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) < 18 THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 18 AND 25 THEN '18-25'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 26 AND 35 THEN '26-35'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 36 AND 45 THEN '36-45'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 46 AND 55 THEN '46-55'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 56 AND 65 THEN '56-65'
            ELSE '65+'
          END as fascia_eta,
          orr.${columnName} as opinione_valore
        FROM opinioni_risposte orr
        JOIN users u ON u.id = orr.user_id
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE orr.${columnName} IS NOT NULL
        AND u.account_type IN ('PERSON', 'P')
        AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
        AND u.data_nascita IS NOT NULL
        AND u.regione_residenza = $1
      )
      SELECT 
        fascia_eta,
        COUNT(CASE WHEN opinione_valore = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN opinione_valore = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN opinione_valore = 'i' THEN 1 END) as indeciso
      FROM eta_groups
      GROUP BY fascia_eta
      ORDER BY 
        CASE fascia_eta
          WHEN 'Under 18' THEN 1
          WHEN '18-25' THEN 2
          WHEN '26-35' THEN 3
          WHEN '36-45' THEN 4
          WHEN '46-55' THEN 5
          WHEN '56-65' THEN 6
          WHEN '65+' THEN 7
        END
    `;
    
    const etaResult = await pool.query(etaQuery, [regionCode]);
    
    res.json({
      success: true,
      minimumCellSize,
      data: suppressSmallCells(etaResult.rows)
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche età opinione regionale:');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche età opinione regionale',
      message: 'Errore interno del server'
    });
  }
});

// GET /api/opinioni/stats/:opinionId/genere/regione/:regione - Ottieni statistiche per genere per regione per opinione
router.get('/stats/:opinionId/genere/regione/:regione', async (req, res) => {
  try {
    const { opinionId, regione } = req.params;
    
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
    
    // Accetta tutte e sole le opinioni ufficiali che hanno una colonna di risposta.
    const columnName = await resolvePublishedOpinionColumn(pool, opinionId);
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per genere dalla tabella opinioni_risposte per la regione specifica
    const genereQuery = `
      SELECT 
        u.genere,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.account_type IN ('PERSON', 'P')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE 
      AND u.genere IS NOT NULL
      AND u.regione_residenza = $1
      GROUP BY u.genere
      ORDER BY u.genere
    `;
    
    const genereResult = await pool.query(genereQuery, [regionCode]);
    
    res.json({
      success: true,
      minimumCellSize,
      data: suppressSmallCells(genereResult.rows)
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere opinione regionale:');
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere opinione regionale',
      message: 'Errore interno del server'
    });
  }
});

module.exports = router;
