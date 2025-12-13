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
      
      // Estrai i dati dai risultati - l'SDK Axiom può restituire dati in formati diversi
      let allRows = [];
      
      // Prova diverse strutture di risposta
      if (queryResult.matches && Array.isArray(queryResult.matches)) {
        // Formato matches (array diretto)
        allRows = queryResult.matches;
      } else if (queryResult.buckets && Array.isArray(queryResult.buckets)) {
        // Formato buckets (array di bucket con rows)
        allRows = queryResult.buckets.flatMap(bucket => {
          if (Array.isArray(bucket.rows)) {
            return bucket.rows;
          } else if (bucket.data && Array.isArray(bucket.data)) {
            return bucket.data;
          }
          return [];
        });
      } else if (queryResult.data && Array.isArray(queryResult.data)) {
        // Formato data diretto
        allRows = queryResult.data;
      } else if (queryResult.data?.rows && Array.isArray(queryResult.data.rows)) {
        // Formato data.rows
        allRows = queryResult.data.rows;
      } else if (queryResult.rows && Array.isArray(queryResult.rows)) {
        // Formato rows diretto
        allRows = queryResult.rows;
      } else {
        // Log per debug se non troviamo i dati
        console.error('⚠️ Struttura risposta Axiom non riconosciuta');
        console.error('⚠️ Query result type:', typeof queryResult);
        if (queryResult) {
          console.error('⚠️ Query result keys:', Object.keys(queryResult));
          // Log solo i primi 500 caratteri per non intasare i log
          const resultStr = JSON.stringify(queryResult, null, 2);
          console.error('⚠️ Query result sample:', resultStr.substring(0, 500));
        }
      }
      
      console.log(`✅ Estratti ${allRows.length} righe totali da Axiom`);
      
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

/**
 * POST /api/admin/axiom-data/find-duplicates
 * Analizza un dataset per trovare duplicati
 */
router.post('/find-duplicates', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { dataset } = req.body;
    
    if (!dataset) {
      return res.status(400).json({
        success: false,
        error: 'Dataset non specificato'
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
    
    try {
      // Determina i campi univoci in base al dataset
      let uniqueKey;
      if (dataset === 'centralized_logs' || dataset.includes('centralized')) {
        uniqueKey = '_time, message, user_id, endpoint';
      } else if (dataset === 'real-time' || dataset.includes('real-time')) {
        uniqueKey = '_time, log_type, action, user_id, resource_id';
      } else {
        uniqueKey = '_time';
      }
      
      // Query per contare i duplicati
      // Conta tutti i record, poi conta i record unici, la differenza sono i duplicati
      const totalQuery = `['${dataset}'] | summarize count()`;
      const uniqueQuery = `['${dataset}'] | summarize count() by ${uniqueKey}`;
      
      const [totalResult, uniqueResult] = await Promise.all([
        axiomClient.query(totalQuery, {
          startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endTime: new Date()
        }),
        axiomClient.query(uniqueQuery, {
          startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endTime: new Date()
        })
      ]);
      
      // Estrai count totale
      let totalCount = 0;
      if (totalResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
        totalCount = parseInt(totalResult.buckets.totals[0].aggregations[0].value);
      } else if (totalResult.status?.rowsExamined) {
        totalCount = parseInt(totalResult.status.rowsExamined);
      }
      
      // Estrai count unici
      let uniqueCount = 0;
      if (uniqueResult.buckets && Array.isArray(uniqueResult.buckets)) {
        // Somma tutti i bucket
        uniqueCount = uniqueResult.buckets.reduce((sum, bucket) => {
          if (bucket.rows && Array.isArray(bucket.rows)) {
            return sum + bucket.rows.length;
          }
          return sum;
        }, 0);
      } else if (uniqueResult.matches && Array.isArray(uniqueResult.matches)) {
        uniqueCount = uniqueResult.matches.length;
      } else if (uniqueResult.data?.rows && Array.isArray(uniqueResult.data.rows)) {
        uniqueCount = uniqueResult.data.rows.length;
      }
      
      const duplicatesCount = Math.max(0, totalCount - uniqueCount);
      
      res.json({
        success: true,
        data: {
          duplicatesCount,
          totalCount,
          uniqueCount,
          uniqueKey
        }
      });
      
    } catch (queryErr) {
      console.error(`❌ Errore analisi duplicati per ${dataset}:`, queryErr.message);
      res.status(500).json({
        success: false,
        error: 'Errore analisi duplicati',
        message: queryErr.message
      });
    }
    
  } catch (error) {
    console.error('Errore ricerca duplicati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore ricerca duplicati',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/axiom-data/remove-duplicates
 * Rimuove i duplicati da un dataset creando un nuovo dataset pulito
 * ATTENZIONE: Axiom non supporta DELETE diretto, quindi creiamo un nuovo dataset
 */
router.post('/remove-duplicates', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { dataset } = req.body;
    
    if (!dataset) {
      return res.status(400).json({
        success: false,
        error: 'Dataset non specificato'
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
    
    const axios = require('axios');
    const apiDomain = region === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
    const baseUrl = `https://${apiDomain}`;
    const edgeDomain = process.env.AXIOM_EDGE_DOMAIN
      || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
    const edgeUrl = `https://${edgeDomain}`;
    
    try {
      // Determina i campi univoci
      let uniqueKey;
      if (dataset === 'centralized_logs' || dataset.includes('centralized')) {
        uniqueKey = '_time, message, user_id, endpoint';
      } else if (dataset === 'real-time' || dataset.includes('real-time')) {
        uniqueKey = '_time, log_type, action, user_id, resource_id';
      } else {
        uniqueKey = '_time';
      }
      
      // Step 0: Conta record totali PRIMA della deduplicazione
      console.log(`📊 Step 0: Conteggio record totali nel dataset originale...`);
      let totalBefore = 0;
      try {
        const totalQuery = `['${dataset}'] | summarize count()`;
        const totalResult = await axiomClient.query(totalQuery, {
          startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endTime: new Date()
        });
        if (totalResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
          totalBefore = parseInt(totalResult.buckets.totals[0].aggregations[0].value);
        } else if (totalResult.status?.rowsExamined) {
          totalBefore = parseInt(totalResult.status.rowsExamined);
        }
        console.log(`✅ Record totali nel dataset originale: ${totalBefore.toLocaleString('it-IT')}`);
      } catch (countErr) {
        console.error('⚠️ Impossibile contare record totali:', countErr.message);
      }
      
      // Step 1: Query per ottenere solo record unici
      console.log(`📊 Step 1: Query record unici per ${dataset}...`);
      const uniqueQuery = `['${dataset}'] | summarize arg_max(_time, *) by ${uniqueKey}`;
      
      const queryResult = await axiomClient.query(uniqueQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      // Estrai record unici
      let uniqueRecords = [];
      if (queryResult.matches && Array.isArray(queryResult.matches)) {
        uniqueRecords = queryResult.matches;
      } else if (queryResult.buckets && Array.isArray(queryResult.buckets)) {
        uniqueRecords = queryResult.buckets.flatMap(bucket => {
          if (Array.isArray(bucket.rows)) return bucket.rows;
          if (bucket.data && Array.isArray(bucket.data)) return bucket.data;
          return [];
        });
      } else if (queryResult.data && Array.isArray(queryResult.data)) {
        uniqueRecords = queryResult.data;
      } else if (queryResult.data?.rows && Array.isArray(queryResult.data.rows)) {
        uniqueRecords = queryResult.data.rows;
      } else if (queryResult.rows && Array.isArray(queryResult.rows)) {
        uniqueRecords = queryResult.rows;
      }
      
      console.log(`✅ Trovati ${uniqueRecords.length} record unici`);
      
      if (uniqueRecords.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nessun record trovato',
          message: 'Il dataset è vuoto o non contiene record nel periodo selezionato'
        });
      }
      
      // Step 2: Crea nuovo dataset temporaneo
      const tempDataset = `${dataset}_deduped_${Date.now()}`;
      console.log(`📦 Step 2: Creazione dataset temporaneo: ${tempDataset}...`);
      
      try {
        await axios.post(
          `${baseUrl}/v1/datasets`,
          {
            name: tempDataset,
            description: `Dataset deduplicato da ${dataset}`
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
            }
          }
        );
        console.log(`✅ Dataset ${tempDataset} creato`);
      } catch (createErr) {
        if (createErr.response?.status === 409) {
          console.log(`⚠️ Dataset ${tempDataset} già esiste`);
        } else {
          throw createErr;
        }
      }
      
      // Step 3: Invia record unici al nuovo dataset in batch
      console.log(`📤 Step 3: Invio record unici al nuovo dataset...`);
      const batchSize = 1000;
      let sent = 0;
      
      for (let i = 0; i < uniqueRecords.length; i += batchSize) {
        const batch = uniqueRecords.slice(i, i + batchSize);
        
        await axios.post(
          `${edgeUrl}/v1/ingest/${tempDataset}`,
          batch,
          {
            headers: {
              'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
            },
            timeout: 60000
          }
        );
        
        sent += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} record inviati (totale: ${sent}/${uniqueRecords.length})`);
      }
      
      // Step 4: Elimina dataset originale (se supportato)
      console.log(`🗑️ Step 4: Eliminazione dataset originale ${dataset}...`);
      try {
        await axios.delete(
          `${baseUrl}/v1/datasets/${dataset}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
              'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
            }
          }
        );
        console.log(`✅ Dataset originale ${dataset} eliminato`);
      } catch (deleteErr) {
        console.error(`⚠️ Impossibile eliminare dataset originale:`, deleteErr.message);
        // Non blocchiamo se non possiamo eliminare, l'utente può farlo manualmente
      }
      
      // Step 5: Rinomina dataset temporaneo (Axiom non supporta rename diretto)
      // Quindi dobbiamo creare un nuovo dataset con il nome originale e copiare i dati
      console.log(`📝 Step 5: Creazione dataset finale con nome originale...`);
      
      try {
        // Crea dataset con nome originale
        await axios.post(
          `${baseUrl}/v1/datasets`,
          {
            name: dataset,
            description: `Dataset deduplicato (sostituito ${new Date().toISOString()})`
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
            }
          }
        );
        
        // Copia i dati dal dataset temporaneo a quello finale
        const copyQuery = `['${tempDataset}']`;
        const copyResult = await axiomClient.query(copyQuery, {
          startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endTime: new Date()
        });
        
        let copyRecords = [];
        if (copyResult.matches && Array.isArray(copyResult.matches)) {
          copyRecords = copyResult.matches;
        } else if (copyResult.buckets && Array.isArray(copyResult.buckets)) {
          copyRecords = copyResult.buckets.flatMap(bucket => {
            if (Array.isArray(bucket.rows)) return bucket.rows;
            if (bucket.data && Array.isArray(bucket.data)) return bucket.data;
            return [];
          });
        } else if (copyResult.data && Array.isArray(copyResult.data)) {
          copyRecords = copyResult.data;
        } else if (copyResult.data?.rows && Array.isArray(copyResult.data.rows)) {
          copyRecords = copyResult.data.rows;
        } else if (copyResult.rows && Array.isArray(copyResult.rows)) {
          copyRecords = copyResult.rows;
        }
        
        // Invia al dataset finale
        for (let i = 0; i < copyRecords.length; i += batchSize) {
          const batch = copyRecords.slice(i, i + batchSize);
          await axios.post(
            `${edgeUrl}/v1/ingest/${dataset}`,
            batch,
            {
              headers: {
                'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
              },
              timeout: 60000
            }
          );
        }
        
        // Elimina dataset temporaneo
        try {
          await axios.delete(
            `${baseUrl}/v1/datasets/${tempDataset}`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
                'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
              }
            }
          );
        } catch (tempDeleteErr) {
          console.error(`⚠️ Impossibile eliminare dataset temporaneo:`, tempDeleteErr.message);
        }
        
        console.log(`✅ Dataset ${dataset} sostituito con versione deduplicata`);
      } catch (renameErr) {
        console.error(`⚠️ Errore durante la sostituzione del dataset:`, renameErr.message);
        // Se fallisce, almeno abbiamo il dataset temporaneo
        return res.json({
          success: true,
          data: {
            message: `Dataset deduplicato creato come ${tempDataset}. Elimina manualmente ${dataset} e rinomina ${tempDataset} su Axiom Dashboard.`,
            tempDataset,
            originalDataset: dataset,
            recordsDeduplicated: uniqueRecords.length
          }
        });
      }
      
      // Calcola quanti duplicati sono stati rimossi
      const duplicatesRemoved = Math.max(0, totalBefore - uniqueRecords.length);
      
      res.json({
        success: true,
        data: {
          message: `Dataset ${dataset} sostituito con versione deduplicata. ${duplicatesRemoved > 0 ? duplicatesRemoved.toLocaleString('it-IT') + ' duplicati rimossi.' : 'Nessun duplicato trovato.'}`,
          recordsDeduplicated: uniqueRecords.length,
          duplicatesRemoved: duplicatesRemoved
        }
      });
      
    } catch (queryErr) {
      console.error(`❌ Errore rimozione duplicati per ${dataset}:`, queryErr.message);
      res.status(500).json({
        success: false,
        error: 'Errore rimozione duplicati',
        message: queryErr.message
      });
    }
    
  } catch (error) {
    console.error('Errore rimozione duplicati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore rimozione duplicati',
      message: error.message
    });
  }
});

module.exports = router;

