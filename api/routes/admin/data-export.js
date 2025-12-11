const express = require('express');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware per autenticazione admin
const requireAdmin = (req, res, next) => {
  // Implementa controllo admin
  // Per ora salto il controllo
  next();
};

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
    const tables = [
      'centralized_logs',
      'security_events', 
      'performance_metrics',
      'health_checks',
      'access_audit',
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
router.post('/start', requireAdmin, async (req, res) => {
  try {
    if (exportStatus.isRunning) {
      return res.status(400).json({ error: 'Export già in corso' });
    }

    const { tables, deleteAfterExport = false, dryRun = false } = req.body;

    if (!tables || tables.length === 0) {
      return res.status(400).json({ error: 'Nessuna tabella selezionata' });
    }

    // Reset stato
    exportStatus = {
      isRunning: true,
      progress: 0,
      currentTable: '',
      totalTables: tables.length,
      exportedRecords: 0,
      totalRecords: 0,
      error: null
    };

    // Avvia processo export
    const scriptPath = path.join(__dirname, '../../scripts/hard-disk-export.js');
    const args = ['export'];
    
    if (deleteAfterExport) args.push('--delete');
    if (dryRun) args.push('--dry-run');

    exportProcess = spawn('node', [scriptPath, ...args], {
      env: { ...process.env, EXPORT_TABLES: tables.join(',') }
    });

    exportProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Export output:', output);
      
      // Parsing output per aggiornare stato
      if (output.includes('Esportazione')) {
        const match = output.match(/Esportazione (\w+)/);
        if (match) {
          exportStatus.currentTable = match[1];
        }
      }
      
      if (output.includes('Record esportati:')) {
        const match = output.match(/Record esportati: (\d+)/);
        if (match) {
          exportStatus.exportedRecords = parseInt(match[1]);
        }
      }
    });

    exportProcess.stderr.on('data', (data) => {
      console.error('Export error:', data.toString());
      exportStatus.error = data.toString();
    });

    exportProcess.on('close', (code) => {
      exportStatus.isRunning = false;
      exportStatus.progress = 100;
      
      if (code !== 0) {
        exportStatus.error = `Processo terminato con codice ${code}`;
      }
      
      exportProcess = null;
    });

    res.json({ message: 'Export avviato', status: exportStatus });

  } catch (error) {
    console.error('Errore avvio export:', error);
    exportStatus.isRunning = false;
    exportStatus.error = error.message;
    res.status(500).json({ error: 'Errore avvio export' });
  }
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
 * GET /api/admin/data-export/centralized-logs
 * Ottiene i 10 log più recenti e il glossario dei livelli
 */
router.get('/centralized-logs', requireAdmin, async (req, res) => {
  try {
    // Ottieni i 10 log più recenti
    const recentLogsQuery = `
      SELECT 
        id,
        timestamp,
        level,
        message,
        user_id,
        ip_address,
        endpoint,
        request_id,
        meta_data
      FROM centralized_logs_decompressed 
      ORDER BY timestamp DESC 
      LIMIT 10
    `;
    
    const recentLogsResult = await pool.query(recentLogsQuery);
    
    // Ottieni il glossario dei livelli
    const glossaryQuery = `
      SELECT 
        code,
        full_name,
        description
      FROM log_level_mapping 
      ORDER BY code
    `;
    
    const glossaryResult = await pool.query(glossaryQuery);
    
    // Statistiche rapide
    const statsQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT level) as unique_levels,
        MIN(timestamp) as oldest_log,
        MAX(timestamp) as newest_log
      FROM centralized_logs_decompressed
    `;
    
    const statsResult = await pool.query(statsQuery);
    
    res.json({
      recentLogs: recentLogsResult.rows,
      glossary: glossaryResult.rows,
      stats: statsResult.rows[0]
    });
    
  } catch (error) {
    console.error('Errore ottenendo log centralizzati:', error);
    res.status(500).json({ error: 'Errore ottenendo log centralizzati' });
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
    const exportableTables = [
      'centralized_logs', 'security_events', 'performance_metrics', 
      'health_checks', 'access_audit', 'audit_logs'
    ];
    
    const analysis = {
      totalDatabaseSizeMB: totalDbSizeMB,
      totalDatabaseSizePretty: totalDbSizePretty,
      categories: {
        exportable: {
          name: 'Tabelle da Esportare',
          tables: [],
          totalSizeMB: 0,
          totalSizeKB: 0,
          color: '#ef4444' // rosso
        },
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
      const tableSizeMB = Math.round(tableSizeBytes / 1024 / 1024);
      const tableSizeKB = Math.round(tableSizeBytes / 1024);
      const tableInfo = {
        name: table.tablename,
        sizeMB: tableSizeMB,
        sizeKB: tableSizeKB,
        sizePretty: table.size_pretty,
        columnCount: parseInt(table.column_count)
      };

      if (exportableTables.includes(table.tablename)) {
        analysis.categories.exportable.tables.push(tableInfo);
        analysis.categories.exportable.totalSizeMB += tableSizeMB;
        analysis.categories.exportable.totalSizeKB += tableSizeKB;
      } else if (table.tablename.includes('user') || table.tablename.includes('auth') || table.tablename.includes('profile') || table.tablename === 'users' || table.tablename.includes('utente') || table.tablename === 'opinioni') {
        analysis.categories.users.tables.push(tableInfo);
        analysis.categories.users.totalSizeMB += tableSizeMB;
        analysis.categories.users.totalSizeKB += tableSizeKB;
      } else if (table.tablename.includes('candidate') || table.tablename.includes('election') || 
                 table.tablename.includes('rappresentante')) {
        analysis.categories.content.tables.push(tableInfo);
        analysis.categories.content.totalSizeMB += tableSizeMB;
        analysis.categories.content.totalSizeKB += tableSizeKB;
      } else if (table.tablename.includes('migration') || table.tablename.includes('session') || table.tablename.includes('cache') ||
                 table.tablename.includes('security') || table.tablename.includes('audit') || table.tablename.includes('performance') ||
                 table.tablename.includes('health') || table.tablename.includes('rate_limit') || table.tablename.includes('validation') ||
                 table.tablename.includes('active_sessions') || table.tablename.includes('suspicious_ips') || table.tablename.includes('security_config')) {
        analysis.categories.system.tables.push(tableInfo);
        analysis.categories.system.totalSizeMB += tableSizeMB;
        analysis.categories.system.totalSizeKB += tableSizeKB;
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
        analysis.categories.ministries.totalSizeMB += tableSizeMB;
        analysis.categories.ministries.totalSizeKB += tableSizeKB;
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
        analysis.categories.votes.totalSizeMB += tableSizeMB;
        analysis.categories.votes.totalSizeKB += tableSizeKB;
      } else if (table.tablename === 'reazioni' || table.tablename === 'programmi' ||
                 table.tablename === 'sostenitori' || table.tablename === 'eventi' ||
                 table.tablename === 'comunicazioni' || table.tablename === 'segnalazioni') {
        // Tabelle per strumenti
        analysis.categories.tools.tables.push(tableInfo);
        analysis.categories.tools.totalSizeMB += tableSizeMB;
        analysis.categories.tools.totalSizeKB += tableSizeKB;
      } else if (table.tablename.includes('voti_') || table.tablename.includes('vote') || 
                 table.tablename.includes('voting') || table.tablename.includes('ballot')) {
        // Altre tabelle di voto (non ministeri)
        analysis.categories.other.tables.push(tableInfo);
        analysis.categories.other.totalSizeMB += tableSizeMB;
        analysis.categories.other.totalSizeKB += tableSizeKB;
      } else {
        // Solo tabelle veramente temporanee o non categorizzabili
        analysis.categories.other.tables.push(tableInfo);
        analysis.categories.other.totalSizeMB += tableSizeMB;
        analysis.categories.other.totalSizeKB += tableSizeKB;
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
