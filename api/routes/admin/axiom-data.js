const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../../middleware/auth');

/**
 * GET /api/admin/axiom-data
 * Ottiene i dati di Axiom in formato tabellare con paginazione
 */
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { dataset, limit = 100, offset = 0, startTime, endTime } = req.query;
    
    if (!dataset) {
      return res.status(400).json({
        success: false,
        error: 'Dataset non specificato',
        message: 'Fornisci il parametro ?dataset=centralized_logs o ?dataset=real-time'
      });
    }
    
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato'
      });
    }
    
    if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
      return res.status(400).json({
        success: false,
        error: 'Token o Org ID Axiom mancanti'
      });
    }
    
    let Axiom;
    let axiomClient;
    try {
      Axiom = require('@axiomhq/axiom-node');
      const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
      axiomClient = new Axiom.Client({
        token: process.env.AXIOM_API_TOKEN,
        orgId: process.env.AXIOM_ORG_ID,
        region: region
      });
    } catch (sdkErr) {
      console.error('⚠️ SDK Axiom non disponibile:', sdkErr.message);
      return res.status(500).json({
        success: false,
        error: 'SDK Axiom non disponibile',
        message: sdkErr.message
      });
    }
    
    // Costruisci query APL per ottenere i dati con limit
    // Axiom APL non supporta offset direttamente, quindi recuperiamo più risultati e facciamo paginazione lato server
    const limitNum = Math.min(parseInt(limit) || 100, 1000); // Max 1000 per query
    const offsetNum = parseInt(offset) || 0;
    
    // Usa startTime e endTime se forniti, altrimenti ultimi 7 giorni
    const endDate = endTime ? new Date(endTime) : new Date();
    const startDate = startTime 
      ? new Date(startTime) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Per la paginazione, recuperiamo limit + offset risultati, poi prendiamo solo quelli necessari
    // Axiom APL non supporta offset, quindi dobbiamo recuperare più dati e filtrare lato server
    const resultsToFetch = limitNum + offsetNum;
    
    // Query APL per ottenere i dati con ordinamento per _time decrescente
    // Usiamo solo limit, senza offset (non supportato)
    const query = `['${dataset}'] | order by _time desc | limit ${resultsToFetch}`;
    
    try {
      const queryResult = await axiomClient.query(query, {
        startTime: startDate,
        endTime: endDate
      });
      
      // Estrai i dati dai risultati
      let allRows = queryResult.buckets?.flatMap(bucket => bucket.rows || []) || [];
      
      // Applica paginazione lato server (Axiom non supporta offset)
      const rows = allRows.slice(offsetNum, offsetNum + limitNum);
      
      // Conta totale eventi (query separata per performance)
      const countQuery = `['${dataset}'] | summarize count()`;
      let totalCount = 0;
      try {
        const countResult = await axiomClient.query(countQuery, {
          startTime: startDate,
          endTime: endDate
        });
        totalCount = parseInt(
          countResult.buckets?.totals?.[0]?.aggregations?.[0]?.value 
          || countResult.status?.rowsExamined 
          || 0
        );
      } catch (countErr) {
        console.error('⚠️ Errore conteggio totale:', countErr.message);
        // Usa il numero di righe restituite come stima
        totalCount = rows.length + offsetNum;
      }
      
      res.json({
        success: true,
        data: {
          rows: rows,
          total: totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: (offsetNum + rows.length) < totalCount
        }
      });
      
    } catch (queryErr) {
      console.error(`❌ Errore query Axiom per ${dataset}:`, queryErr.message);
      res.status(500).json({
        success: false,
        error: 'Errore query Axiom',
        message: queryErr.message
      });
    }
    
  } catch (error) {
    console.error('Errore recupero dati Axiom:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero dati Axiom',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/axiom-data/datasets
 * Ottiene la lista dei dataset disponibili su Axiom
 */
router.get('/datasets', verifyToken, requireAdmin, async (req, res) => {
  try {
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato'
      });
    }
    
    if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
      return res.status(400).json({
        success: false,
        error: 'Token o Org ID Axiom mancanti'
      });
    }
    
    let Axiom;
    let axiomClient;
    try {
      Axiom = require('@axiomhq/axiom-node');
      const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
      axiomClient = new Axiom.Client({
        token: process.env.AXIOM_API_TOKEN,
        orgId: process.env.AXIOM_ORG_ID,
        region: region
      });
    } catch (sdkErr) {
      console.error('⚠️ SDK Axiom non disponibile:', sdkErr.message);
      return res.status(500).json({
        success: false,
        error: 'SDK Axiom non disponibile',
        message: sdkErr.message
      });
    }
    
    try {
      // Ottieni lista dataset usando SDK
      const datasets = await axiomClient.datasets.list();
      
      // Filtra solo i dataset rilevanti (centralized_logs e real-time)
      const relevantDatasets = [
        {
          name: process.env.AXIOM_DATASET || 'centralized_logs',
          label: 'Centralized Logs',
          description: 'Log applicativi centralizzati'
        },
        {
          name: process.env.AXIOM_REALTIME_DATASET || 'real-time',
          label: 'Real-time',
          description: 'Audit logs, security events e performance metrics'
        }
      ];
      
      res.json({
        success: true,
        data: relevantDatasets
      });
      
    } catch (listErr) {
      console.error('❌ Errore lista dataset Axiom:', listErr.message);
      // Fallback: restituisci dataset predefiniti
      res.json({
        success: true,
        data: [
          {
            name: process.env.AXIOM_DATASET || 'centralized_logs',
            label: 'Centralized Logs',
            description: 'Log applicativi centralizzati'
          },
          {
            name: process.env.AXIOM_REALTIME_DATASET || 'real-time',
            label: 'Real-time',
            description: 'Audit logs, security events e performance metrics'
          }
        ]
      });
    }
    
  } catch (error) {
    console.error('Errore recupero dataset Axiom:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero dataset Axiom',
      message: error.message
    });
  }
});

module.exports = router;

