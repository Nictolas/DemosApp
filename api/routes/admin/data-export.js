const express = require('express');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
require('dotenv').config();

const router = express.Router();
router.use(verifyToken, requireAdmin);

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/admin/data-export/axiom-analysis
 * Ottiene conteggi dei dataset Axiom per grafico a torta
 */
router.get('/axiom-analysis', requireAdmin, async (req, res) => {
  try {
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({ error: 'Axiom non abilitato' });
    }
    if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
      return res.status(400).json({ error: 'Token o Org ID Axiom mancanti' });
    }

    const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
    // Per le query APL, usa l'API principale, non l'edge domain
    // L'edge domain è solo per l'ingest, le query vanno sull'API principale
    const apiDomain = region === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
    const baseUrl = `https://${apiDomain}`;
    
    const edgeDomain = process.env.AXIOM_EDGE_DOMAIN
      || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');

    const datasets = [
      { name: process.env.AXIOM_DATASET || 'centralized_logs', label: 'Centralized Logs' },
      { name: process.env.AXIOM_REALTIME_DATASET || 'real-time', label: 'Audit Logs' }
    ];

    const results = [];

    // Usa SDK Axiom per ottenere statistiche REALI (l'API REST restituisce 403)
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
    }
    
    for (const ds of datasets) {
      try {
        let eventCount = 0;
        let dataSizeMB = 0;
        let source = 'unknown';
        
        // Usa SDK per ottenere count REALE tramite query APL
        if (axiomClient) {
          try {
            const query = `['${ds.name}'] | summarize count()`;
            const queryResult = await axiomClient.query(query, {
              startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Ultimo anno
              endTime: new Date()
            });
            
            // Estrai count dal risultato
            const countValue = queryResult.buckets?.totals?.[0]?.aggregations?.[0]?.value 
              || queryResult.status?.rowsExamined 
              || 0;
            
            eventCount = parseInt(countValue) || 0;
            
            // Calcola dimensione REALE basandosi sui dati che abbiamo visto su Axiom Dashboard
            // Dati reali: 983K eventi = 321.97 MB → ~335 bytes per evento
            // Usiamo questo rapporto per calcolare la dimensione reale
            const bytesPerEvent = 335; // Calcolato da: 321.97 MB / 983K eventi
            const dataSizeBytes = eventCount * bytesPerEvent;
            dataSizeMB = dataSizeBytes / (1024 * 1024);
            
            source = 'sdk_query';
            console.log(`✅ ${ds.name}: ${eventCount.toLocaleString()} eventi (SDK), ${dataSizeMB.toFixed(2)} MB calcolati`);
            
          } catch (sdkQueryErr) {
            console.error(`⚠️ Query SDK fallita per ${ds.name}:`, sdkQueryErr.message);
            // Fallback alle statistiche di migrazione
            throw sdkQueryErr;
          }
        } else {
          throw new Error('SDK non disponibile');
        }
        
        results.push({
          name: ds.name,
          label: ds.label,
          count: eventCount,
          dataSizeMB: dataSizeMB,
          dataSizeBytes: eventCount * 335,
          source: source,
          error: null
        });
        
      } catch (err) {
        // Fallback 1: prova con statistiche manuali inserite dall'utente
        try {
          const { Pool } = require('pg');
          const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
          });
          
          const manualStatsResult = await pool.query(
            'SELECT events_count, size_mb FROM axiom_manual_stats WHERE dataset_name = $1',
            [ds.name]
          );
          
          if (manualStatsResult.rows.length > 0) {
            const manualStats = manualStatsResult.rows[0];
            const eventCount = parseInt(manualStats.events_count) || 0;
            const dataSizeMB = parseFloat(manualStats.size_mb) || 0;
            const dataSizeBytes = dataSizeMB * 1024 * 1024;
            
            await pool.end();
            
            results.push({
              name: ds.name,
              label: ds.label,
              count: eventCount,
              dataSizeMB: dataSizeMB,
              dataSizeBytes: dataSizeBytes,
              source: 'manual_stats',
              error: null
            });
            continue;
          }
          
          // Fallback 2: prova con statistiche di migrazione salvate
          const statsResult = await pool.query(
            'SELECT events_migrated FROM axiom_migration_stats WHERE dataset_name = $1',
            [ds.name]
          );
          
          await pool.end();
          
          if (statsResult.rows.length > 0) {
            const eventCount = parseInt(statsResult.rows[0].events_migrated) || 0;
            const bytesPerEvent = 335; // Basato su dati reali osservati
            const dataSizeBytes = eventCount * bytesPerEvent;
            const dataSizeMB = dataSizeBytes / (1024 * 1024);
            
            results.push({
              name: ds.name,
              label: ds.label,
              count: eventCount,
              dataSizeMB: dataSizeMB,
              dataSizeBytes: dataSizeBytes,
              source: 'migration_stats_fallback',
              error: null
            });
            continue;
          }
        } catch (fallbackErr) {
          // Ignora errori fallback
        }
        
        // Se tutto fallisce, mostra errore
        console.error(`❌ Impossibile ottenere statistiche per ${ds.name}:`, err.message);
        results.push({
          name: ds.name,
          label: ds.label,
          count: null,
          dataSizeMB: null,
          error: `Impossibile ottenere statistiche: ${err.message}`,
          needsManualCheck: true
        });
      }
    }

    // Calcola totale solo per dataset con count valido (non null)
    const totalEvents = results.reduce((sum, ds) => {
      return sum + (ds.count !== null && ds.count !== undefined ? ds.count : 0);
    }, 0);
    
    // Calcola totale MB solo per dataset con dataSizeMB valido (non null)
    const totalDataSizeMB = results.reduce((sum, ds) => {
      return sum + (ds.dataSizeMB !== null && ds.dataSizeMB !== undefined ? ds.dataSizeMB : 0);
    }, 0);
    
    // Verifica se ci sono dataset che richiedono verifica manuale
    const needsManualCheck = results.some(ds => ds.needsManualCheck);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalDataSizeMB,
        datasets: results,
        edgeDomain,
        region,
        apiDomain: baseUrl.replace('https://', ''),
        needsManualCheck,
        migrationCompleted: true // Indica che la migrazione è stata completata
      }
    });
  } catch (error) {
    console.error('Errore analisi Axiom:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore ottenendo analisi Axiom',
      message: error.message 
    });
  }
});

/**
 * POST /api/admin/data-export/axiom-stats-manual
 * Permette di inserire manualmente le statistiche reali da Axiom Dashboard
 * quando l'API non è disponibile
 */
router.post('/axiom-stats-manual', requireAdmin, async (req, res) => {
  try {
    const { datasets } = req.body; // Array di { name, events, sizeMB }
    
    if (!datasets || !Array.isArray(datasets)) {
      return res.status(400).json({
        success: false,
        error: 'Formato dati non valido',
        message: 'Fornisci un array di dataset con name, events e sizeMB'
      });
    }
    
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Crea tabella se non esiste
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS axiom_manual_stats (
          id SERIAL PRIMARY KEY,
          dataset_name VARCHAR(255) NOT NULL,
          events_count BIGINT NOT NULL,
          size_mb DECIMAL(10, 2) NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(dataset_name)
        )
      `);
    } catch (createErr) {
      // Ignora se già esiste
    }
    
    const results = [];
    
    for (const ds of datasets) {
      try {
        await pool.query(`
          INSERT INTO axiom_manual_stats (dataset_name, events_count, size_mb)
          VALUES ($1, $2, $3)
          ON CONFLICT (dataset_name) 
          DO UPDATE SET 
            events_count = EXCLUDED.events_count,
            size_mb = EXCLUDED.size_mb,
            updated_at = NOW()
        `, [ds.name, ds.events || 0, ds.sizeMB || 0]);
        
        results.push({
          name: ds.name,
          success: true
        });
      } catch (err) {
        results.push({
          name: ds.name,
          success: false,
          error: err.message
        });
      }
    }
    
    await pool.end();
    
    res.json({
      success: true,
      message: 'Statistiche manuali salvate con successo',
      results
    });
    
  } catch (error) {
    console.error('Errore salvataggio statistiche manuali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore salvataggio statistiche manuali',
      message: error.message
    });
  }
});

// Stato export globale
let exportProcess = null;
let exportStatus = {
  isRunning: false,
  progress: 0,
  currentTable: '',
  totalTables: 0,
  exportedRecords: 0,
  totalRecords: 0,
  error: null
};

/**
 * GET /api/admin/data-export/tables
 * Ottiene informazioni sulle tabelle da esportare
 */
router.get('/tables', requireAdmin, async (req, res) => {
  try {
    // NOTA: security_events e access_audit sono stati rimossi perché ora vengono salvati solo su Axiom
    const tables = [
      'centralized_logs',
      'performance_metrics',
      'health_checks',
      'audit_logs'
    ];

    const tableInfo = [];

    for (const tableName of tables) {
      try {
        // Verifica se la tabella esiste
        const existsQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `;
        
        const existsResult = await pool.query(existsQuery, [tableName]);
        
        if (!existsResult.rows[0].exists) {
          tableInfo.push({
            name: tableName,
            enabled: false,
            retentionDays: 30,
            recordCount: 0,
            sizeMB: 0,
            sizeKB: 0,
            sizeBytes: 0
          });
          continue;
        }

        // Conta record
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
        const countResult = await pool.query(countQuery);
        
        // Dimensione tabella
        const sizeQuery = `
          SELECT pg_size_pretty(pg_total_relation_size($1)) as size_pretty,
                 pg_total_relation_size($1) as size_bytes
        `;
        const sizeResult = await pool.query(sizeQuery, [tableName]);
        
        // Record da esportare (più vecchi di 30 giorni)
        const exportCountQuery = `
          SELECT COUNT(*) as count 
          FROM ${tableName} 
          WHERE created_at < NOW() - INTERVAL '30 days'
        `;
        const exportCountResult = await pool.query(exportCountQuery);

        const sizeBytes = parseInt(sizeResult.rows[0].size_bytes);
        const sizeMB = Math.round(sizeBytes / 1024 / 1024);
        const sizeKB = Math.round(sizeBytes / 1024);
        
        tableInfo.push({
          name: tableName,
          enabled: true,
          retentionDays: 30,
          recordCount: parseInt(countResult.rows[0].count),
          exportableRecords: parseInt(exportCountResult.rows[0].count),
          sizeMB: sizeMB,
          sizeKB: sizeKB,
          sizeBytes: sizeBytes
        });

      } catch (error) {
        console.error(`Errore ottenendo info per ${tableName}:`, error);
        tableInfo.push({
          name: tableName,
          enabled: false,
          retentionDays: 30,
          recordCount: 0,
          exportableRecords: 0,
          sizeMB: 0,
          sizeKB: 0,
          sizeBytes: 0,
          error: error.message
        });
      }
    }

    res.json(tableInfo);

  } catch (error) {
    console.error('Errore ottenendo info tabelle:', error);
    res.status(500).json({ error: 'Errore ottenendo informazioni tabelle' });
  }
});

/**
 * GET /api/admin/data-export/status
 * Ottiene lo stato dell'export in corso
 */
router.get('/status', requireAdmin, async (req, res) => {
  res.json(exportStatus);
});

/**
 * POST /api/admin/data-export/start
 * Avvia l'export dei dati
 */
// Legacy disk export is retired until retention, delivery and deletion policy are approved.
// Never spawn the old script or accept its --delete option via HTTP.
router.post('/start', requireAdmin, (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    error: 'Export legacy non disponibile: verifica GDPR e conservazione dati in corso'
  });
});

/**
 * POST /api/admin/data-export/stop
 * Interrompe l'export in corso
 */
router.post('/stop', requireAdmin, async (req, res) => {
  try {
    if (!exportStatus.isRunning || !exportProcess) {
      return res.status(400).json({ error: 'Nessun export in corso' });
    }

    exportProcess.kill('SIGTERM');
    exportStatus.isRunning = false;
    exportStatus.error = 'Export interrotto dall\'utente';
    exportProcess = null;

    res.json({ message: 'Export interrotto' });

  } catch (error) {
    console.error('Errore stop export:', error);
    res.status(500).json({ error: 'Errore interruzione export' });
  }
});

/**
 * GET /api/admin/data-export/history
 * Ottiene la cronologia degli export
 */
router.get('/history', requireAdmin, async (req, res) => {
  try {
    const exportDir = process.env.EXPORT_DIR || '/mnt/external-drive/archivio';
    const indexPath = path.join(exportDir, 'index_generale.json');

    try {
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);
      
      const history = index.exports.map(exportData => ({
        id: exportData.exportDate,
        date: new Date(exportData.exportDate).toLocaleDateString('it-IT'),
        totalRecords: exportData.totalRecords,
        totalFiles: exportData.totalFiles,
        tables: exportData.totalTables,
        status: 'completed'
      }));

      res.json(history);

    } catch (error) {
      // File non esiste, restituisci array vuoto
      res.json([]);
    }

  } catch (error) {
    console.error('Errore ottenendo cronologia:', error);
    res.status(500).json({ error: 'Errore ottenendo cronologia export' });
  }
});

/**
 * GET /api/admin/data-export/download/:exportId
 * Download di un export specifico
 */
router.get('/download/:exportId', requireAdmin, async (req, res) => {
  try {
    const { exportId } = req.params;
    const exportDir = process.env.EXPORT_DIR || '/mnt/external-drive/archivio';
    
    // Cerca la directory dell'export
    const year = new Date(exportId).getFullYear();
    const month = String(new Date(exportId).getMonth() + 1).padStart(2, '0');
    const monthName = new Date(exportId).toLocaleString('it-IT', { month: 'long' });
    
    const exportPath = path.join(exportDir, year.toString(), `${month}-${monthName}`);
    
    try {
      // Verifica se la directory esiste
      await fs.access(exportPath);
      
      // Crea zip della directory
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      res.attachment(`export_${exportId}.zip`);
      archive.pipe(res);
      
      archive.directory(exportPath, false);
      await archive.finalize();

    } catch (error) {
      res.status(404).json({ error: 'Export non trovato' });
    }

  } catch (error) {
    console.error('Errore download export:', error);
    res.status(500).json({ error: 'Errore download export' });
  }
});

/**
 * GET /api/admin/data-export/security-events-stats
 * Ottiene statistiche dettagliate dei Security Events da Axiom
 */
router.get('/security-events-stats', requireAdmin, async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({ 
        error: 'Axiom non abilitato',
        message: 'I security events sono disponibili solo con Axiom abilitato'
      });
    }
    
    const { getSecurityEvents, countAxiomRecords, queryAxiom } = require('../../utils/axiomQueryHelper');
    const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
    
    // Conta totale security events (ultimo anno)
    const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endTime = new Date();
    
    // Query per contare security events (hanno type e severity)
    const countQuery = `['${dataset}'] | where type != null AND severity != null | summarize count()`;
    let totalCount = 0;
    try {
      const countResult = await queryAxiom(countQuery, { startTime, endTime });
      // Estrai count dal risultato
      if (countResult && Array.isArray(countResult) && countResult.length > 0) {
        totalCount = countResult.length; // Approssimativo
      } else {
        // Prova con query diversa
        const allRecords = await queryAxiom(`['${dataset}'] | where type != null AND severity != null | limit 100000`, { startTime, endTime });
        totalCount = allRecords.filter(r => r.type && r.severity).length;
      }
    } catch (err) {
      console.error('Errore conteggio security events:', err);
      // Fallback: conta manualmente
      const allRecords = await queryAxiom(`['${dataset}'] | limit 100000`, { startTime, endTime });
      totalCount = allRecords.filter(r => r.type && r.severity).length;
    }
    
    // Ottieni ultimi 10 security events
    const recentEvents = await getSecurityEvents({
      startTime,
      endTime,
      limit: 10
    });
    
    // Calcola statistiche per severity
    const severityStats = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    // Query per severity (ultimi 1000 eventi per performance)
    try {
      const severityQuery = `['${dataset}'] | where type != null AND severity != null | summarize count() by severity | limit 1000`;
      const severityResults = await queryAxiom(severityQuery, { startTime, endTime });
      
      // Se la query non restituisce il formato atteso, conta manualmente
      if (recentEvents.length > 0) {
        recentEvents.forEach(event => {
          if (event.severity && severityStats.hasOwnProperty(event.severity)) {
            severityStats[event.severity]++;
          }
        });
      }
    } catch (err) {
      console.error('Errore calcolo severity stats:', err);
    }
    
    // Calcola dimensione approssimativa (basata su ~335 bytes per evento)
    const bytesPerEvent = 335;
    const dataSizeBytes = totalCount * bytesPerEvent;
    const dataSizeMB = dataSizeBytes / (1024 * 1024);
    
    res.json({
      success: true,
      totalEvents: totalCount,
      dataSizeMB: dataSizeMB,
      dataSizeBytes: dataSizeBytes,
      recentEvents: recentEvents.slice(0, 10),
      severityStats: severityStats,
      dataset: dataset,
      period: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Errore ottenendo statistiche security events:', error);
    res.status(500).json({ 
      error: 'Errore ottenendo statistiche security events',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/data-export/centralized-logs
 * Ottiene i 10 log più recenti e il glossario dei livelli
 */
router.get('/centralized-logs', requireAdmin, async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({ 
        error: 'Axiom non abilitato',
        message: 'I log centralizzati sono disponibili solo con Axiom abilitato'
      });
    }
    
    const { getCentralizedLogs, countAxiomRecords } = require('../../utils/axiomQueryHelper');
    
    // Ottieni i 10 log più recenti da Axiom
    const recentLogs = await getCentralizedLogs({
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(),
      limit: 10
    });
    
    // Formatta per compatibilità
    const formattedLogs = recentLogs.map(log => ({
      id: log._time || Date.now().toString(),
      timestamp: log._time || new Date().toISOString(),
      level: log.level || 'INFO',
      message: log.message || '',
      user_id: log.user_id || null,
      ip_address: log.ip_address || null,
      endpoint: log.endpoint || null,
      request_id: null, // Non più disponibile (rimosso per GDPR)
      meta_data: log.meta_data || {}
    }));
    
    // Ottieni il glossario dei livelli (dal database)
    const glossaryQuery = `
      SELECT 
        code,
        full_name,
        description
      FROM log_level_mapping 
      ORDER BY code
    `;
    
    const glossaryResult = await pool.query(glossaryQuery);
    
    // Statistiche rapide da Axiom
    const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
    const totalLogs = await countAxiomRecords(dataset, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    // Calcola livelli unici
    const uniqueLevels = new Set(recentLogs.map(log => log.level).filter(Boolean));
    
    // Calcola oldest e newest dai log recenti (approssimativo)
    const timestamps = recentLogs.map(log => log._time).filter(Boolean).sort();
    const oldest_log = timestamps.length > 0 ? timestamps[0] : null;
    const newest_log = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;
    
    res.json({
      recentLogs: formattedLogs,
      glossary: glossaryResult.rows,
      stats: {
        total_logs: totalLogs,
        unique_levels: uniqueLevels.size,
        oldest_log: oldest_log,
        newest_log: newest_log
      }
    });
    
  } catch (error) {
    console.error('Errore ottenendo log centralizzati:', error);
    res.status(500).json({ 
      error: 'Errore ottenendo log centralizzati',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/data-export/database-analysis
 * Ottiene analisi dettagliata del database per grafico a torta
 */
router.get('/database-analysis', requireAdmin, async (req, res) => {
  try {
    // Verifica se il database è connesso
    let totalDbSizeMB = 0;
    let totalDbSizePretty = "0 MB";
    
    // Dimensione totale database
    const dbSizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty,
             pg_database_size(current_database()) as size_bytes
    `;
    const dbSizeResult = await pool.query(dbSizeQuery);
    totalDbSizeMB = Math.round(parseInt(dbSizeResult.rows[0].size_bytes) / 1024 / 1024);
    totalDbSizePretty = dbSizeResult.rows[0].size_pretty;

    // Ottieni tutte le tabelle del database con le loro dimensioni
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename AND table_schema = schemaname) as column_count
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    // Categorizza le tabelle
    // NOTA: Le tabelle da esportare (centralized_logs, audit_logs, performance_metrics, health_checks)
    // sono state migrate su Axiom, quindi non servono più nel DB per l'export
    // Le tabelle vengono ora categorizzate solo per visualizzazione, non per export
    
    const analysis = {
      totalDatabaseSizeMB: totalDbSizeMB,
      totalDatabaseSizePretty: totalDbSizePretty,
      categories: {
        users: {
          name: 'Dati Utenti',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#3b82f6' // blu
        },
        content: {
          name: 'Contenuti App',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#10b981' // verde
        },
        system: {
          name: 'Sistema',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#f59e0b' // arancione
        },
        ministries: {
          name: 'Ministeri',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#dc2626' // rosso scuro
        },
        votes: {
          name: 'Voti',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#7c3aed' // viola
        },
        tools: {
          name: 'Strumenti',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#059669' // verde scuro
        },
        other: {
          name: 'Tabelle Temporanee',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#6b7280' // grigio
        }
      }
    };

    // Categorizza ogni tabella
    for (const table of tablesResult.rows) {
      const tableSizeBytes = parseInt(table.size_bytes);
      // Calcola MB con decimali per precisione (arrotonda a 2 decimali)
      const tableSizeMB = Math.round((tableSizeBytes / 1024 / 1024) * 100) / 100;
      const tableSizeKB = Math.round((tableSizeBytes / 1024) * 100) / 100;
      const tableInfo = {
        name: table.tablename,
        sizeMB: tableSizeMB,
        sizeKB: tableSizeKB,
        sizePretty: table.size_pretty,
        columnCount: parseInt(table.column_count)
      };

      // Le tabelle di logging (centralized_logs, audit_logs, performance_metrics, health_checks)
      // vengono categorizzate come "Sistema" perché sono già migrate su Axiom
      if (table.tablename.includes('user') || table.tablename.includes('auth') || table.tablename.includes('profile') || table.tablename === 'users' || table.tablename.includes('utente') || table.tablename === 'opinioni') {
        analysis.categories.users.tables.push(tableInfo);
        analysis.categories.users.totalSizeMB = Math.round((analysis.categories.users.totalSizeMB + tableSizeMB) * 100) / 100;
        analysis.categories.users.totalSizeKB = Math.round((analysis.categories.users.totalSizeKB + tableSizeKB) * 100) / 100;
      } else if (table.tablename.includes('candidate') || table.tablename.includes('election') || 
                 table.tablename.includes('rappresentante')) {
        analysis.categories.content.tables.push(tableInfo);
        analysis.categories.content.totalSizeMB = Math.round((analysis.categories.content.totalSizeMB + tableSizeMB) * 100) / 100;
        analysis.categories.content.totalSizeKB = Math.round((analysis.categories.content.totalSizeKB + tableSizeKB) * 100) / 100;
      } else if (table.tablename.includes('migration') || table.tablename.includes('session') || table.tablename.includes('cache') ||
                 table.tablename.includes('security') || table.tablename.includes('audit') || table.tablename.includes('performance') ||
                 table.tablename.includes('health') || table.tablename.includes('rate_limit') || table.tablename.includes('validation') ||
                 table.tablename.includes('active_sessions') || table.tablename.includes('suspicious_ips') || table.tablename.includes('security_config')) {
        analysis.categories.system.tables.push(tableInfo);
        analysis.categories.system.totalSizeMB = Math.round((analysis.categories.system.totalSizeMB + tableSizeMB) * 100) / 100;
        analysis.categories.system.totalSizeKB = Math.round((analysis.categories.system.totalSizeKB + tableSizeKB) * 100) / 100;
      } else if (table.tablename === 'voti_istruzione' || table.tablename === 'voti_interno' || 
                 table.tablename === 'voti_difesa' || table.tablename === 'voti_giustizia' ||
                 table.tablename === 'voti_economia' || table.tablename === 'voti_esteri' ||
                 table.tablename === 'voti_lavoro' || table.tablename === 'voti_salute' ||
                 table.tablename === 'voti_cultura' || table.tablename === 'voti_ministri' ||
                 table.tablename === 'voti_trasporti' || table.tablename === 'voti_ambiente' ||
                 table.tablename === 'voti_sport' || table.tablename === 'voti_primo_ministro' ||
                 table.tablename === 'consenso_governo') {
        // Tabelle specifiche per i ministeri
        analysis.categories.ministries.tables.push(tableInfo);
        analysis.categories.ministries.totalSizeMB = Math.round((analysis.categories.ministries.totalSizeMB + tableSizeMB) * 100) / 100;
        analysis.categories.ministries.totalSizeKB = Math.round((analysis.categories.ministries.totalSizeKB + tableSizeKB) * 100) / 100;
      } else if (table.tablename === 'iniziative_popolari' || table.tablename === 'voti_iniziative_popolari' ||
                 table.tablename === 'voti_ice' || table.tablename === 'ice' ||
                 table.tablename === 'amnistia' || table.tablename === 'voti_opinioni_proposte' ||
                 table.tablename === 'opinioni_proposte' || table.tablename === 'richieste_grazia' ||
                 table.tablename === 'referendum_abrogativi' || table.tablename === 'grazia_requests' ||
                 table.tablename === 'voti_referendum_abrogativi' || table.tablename === 'voti_capo_stato' ||
                 table.tablename === 'voti_grazia' || table.tablename === 'voti_amnistia' ||
                 table.tablename === 'consenso_capo_stato') {
        // Tabelle per i voti
        analysis.categories.votes.tables.push(tableInfo);
        analysis.categories.votes.totalSizeMB = Math.round((analysis.categories.votes.totalSizeMB + tableSizeMB) * 100) / 100;
        analysis.categories.votes.totalSizeKB = Math.round((analysis.categories.votes.totalSizeKB + tableSizeKB) * 100) / 100;
      } else if (table.tablename === 'reazioni' || table.tablename === 'programmi' ||
                 table.tablename === 'sostenitori' || table.tablename === 'eventi' ||
                 table.tablename === 'comunicazioni' || table.tablename === 'segnalazioni') {
        // Tabelle per strumenti
        analysis.categories.tools.tables.push(tableInfo);
        analysis.categories.tools.totalSizeMB = Math.round((analysis.categories.tools.totalSizeMB + tableSizeMB) * 100) / 100;
        analysis.categories.tools.totalSizeKB = Math.round((analysis.categories.tools.totalSizeKB + tableSizeKB) * 100) / 100;
      } else if (table.tablename.includes('voti_') || table.tablename.includes('vote') || 
                 table.tablename.includes('voting') || table.tablename.includes('ballot')) {
        // Altre tabelle di voto (non ministeri)
        analysis.categories.other.tables.push(tableInfo);
        analysis.categories.other.totalSizeMB += tableSizeMB;
        analysis.categories.other.totalSizeKB += tableSizeKB;
      } else {
        // Solo tabelle veramente temporanee o non categorizzabili
        analysis.categories.other.tables.push(tableInfo);
        analysis.categories.other.totalSizeMB = Math.round((analysis.categories.other.totalSizeMB + tableSizeMB) * 100) / 100;
        analysis.categories.other.totalSizeKB = Math.round((analysis.categories.other.totalSizeKB + tableSizeKB) * 100) / 100;
      }
    }

    // Calcola percentuali
    for (const category of Object.values(analysis.categories)) {
      category.percentage = totalDbSizeMB > 0 ? Math.round((category.totalSizeMB / totalDbSizeMB) * 100) : 0;
    }

    res.json(analysis);

  } catch (error) {
    console.error('Errore analisi database:', error);
    res.status(500).json({ error: 'Errore analisi database' });
  }
});

/**
 * GET /api/admin/data-export/stats
 * Ottiene statistiche generali
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const exportDir = process.env.EXPORT_DIR || '/mnt/external-drive/archivio';
    
    // Statistiche directory
    let totalSize = 0;
    let totalFiles = 0;
    
    try {
      const indexPath = path.join(exportDir, 'index_generale.json');
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);
      
      totalFiles = index.exports.reduce((sum, exp) => sum + exp.totalFiles, 0);
      totalSize = index.exports.reduce((sum, exp) => sum + (exp.totalRecords * 0.001), 0); // Stima
      
    } catch (error) {
      // Directory non esiste o vuota
    }

    // Statistiche database
    const dbSizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty,
             pg_database_size(current_database()) as size_bytes
    `;
    const dbSizeResult = await pool.query(dbSizeQuery);

    res.json({
      database: {
        sizePretty: dbSizeResult.rows[0].size_pretty,
        sizeMB: Math.round(parseInt(dbSizeResult.rows[0].size_bytes) / 1024 / 1024)
      },
      exports: {
        totalFiles,
        totalSizeMB: Math.round(totalSize),
        lastExport: exportStatus.isRunning ? 'In corso' : 'Nessuno'
      }
    });

  } catch (error) {
    console.error('Errore ottenendo statistiche:', error);
    res.status(500).json({ error: 'Errore ottenendo statistiche' });
  }
});

module.exports = router;
