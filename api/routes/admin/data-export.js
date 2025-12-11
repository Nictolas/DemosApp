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
    const edgeDomain = process.env.AXIOM_EDGE_DOMAIN
      || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
    const baseUrl = `https://${edgeDomain}`;

    const datasets = [
      { name: process.env.AXIOM_DATASET || 'centralized_logs', label: 'Centralized Logs' },
      { name: process.env.AXIOM_REALTIME_DATASET || 'real-time', label: 'Audit Logs' }
    ];

    const results = [];

    for (const ds of datasets) {
      try {
        const aplQuery = `['${ds.name}'] | summarize count()`;
        const response = await axios.post(
          `${baseUrl}/v1/datasets/_apl`,
          { apl: aplQuery },
          {
            headers: {
              'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
            },
            timeout: 30000
          }
        );

        // Estrarre il conteggio indipendentemente dalla forma di risposta
        let count = 0;
        const data = response.data || {};
        if (data?.data?.rows && Array.isArray(data.data.rows) && data.data.rows.length > 0) {
          const firstRow = data.data.rows[0];
          if (typeof firstRow === 'object') {
            const firstKey = Object.keys(firstRow)[0];
            count = Number(firstRow[firstKey]) || 0;
          } else if (Array.isArray(firstRow)) {
            count = Number(firstRow[0]) || 0;
          }
        } else if (typeof data?.count === 'number') {
          count = data.count;
        } else if (data?.matches?.total) {
          count = Number(data.matches.total) || 0;
        }

        results.push({
          name: ds.name,
          label: ds.label,
          count,
          error: null
        });
      } catch (err) {
        console.error(`Errore conteggio Axiom per ${ds.name}:`, err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
        results.push({
          name: ds.name,
          label: ds.label,
          count: 0,
          error: errorMessage
        });
        // Se è un errore 404, potrebbe significare che il dataset non esiste o non ha dati
        if (err.response?.status === 404) {
          console.log(`Dataset ${ds.name} non trovato o vuoto su Axiom`);
        }
      }
    }

    const totalEvents = results.reduce((sum, ds) => sum + (ds.count || 0), 0);

    res.json({
      success: true,
      data: {
        totalEvents,
        datasets: results,
        edgeDomain,
        region
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
