const express = require('express');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

// Middleware per autenticazione admin
const requireAdmin = (req, res, next) => {
  // Implementa controllo admin
  // Per ora salto il controllo
  next();
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
            sizeMB: 0
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

        tableInfo.push({
          name: tableName,
          enabled: true,
          retentionDays: 30,
          recordCount: parseInt(countResult.rows[0].count),
          exportableRecords: parseInt(exportCountResult.rows[0].count),
          sizeMB: Math.round(parseInt(sizeResult.rows[0].size_bytes) / 1024 / 1024)
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
 * GET /api/admin/data-export/database-analysis
 * Ottiene analisi dettagliata del database per grafico a torta
 */
router.get('/database-analysis', requireAdmin, async (req, res) => {
  try {
    // Verifica se il database è connesso
    let totalDbSizeMB = 0;
    let totalDbSizePretty = "0 MB";
    
    try {
      // Dimensione totale database
      const dbSizeQuery = `
        SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty,
               pg_database_size(current_database()) as size_bytes
      `;
      const dbSizeResult = await pool.query(dbSizeQuery);
      totalDbSizeMB = Math.round(parseInt(dbSizeResult.rows[0].size_bytes) / 1024 / 1024);
      totalDbSizePretty = dbSizeResult.rows[0].size_pretty;
    } catch (dbError) {
      console.log('Database non connesso, uso dati di esempio per demo');
      // Dati di esempio realistici per demo
      totalDbSizeMB = 1250;
      totalDbSizePretty = "1.2 GB";
    }

    // Ottieni tutte le tabelle del database con le loro dimensioni
    let tablesResult;
    try {
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
      
      tablesResult = await pool.query(tablesQuery);
    } catch (dbError) {
      console.log('Database non connesso, uso tabelle di esempio per demo');
      // Tabelle di esempio realistiche per demo
      tablesResult = {
        rows: [
          { tablename: 'centralized_logs', size_pretty: '180 MB', size_bytes: '188743680', column_count: '8' },
          { tablename: 'security_events', size_pretty: '95 MB', size_bytes: '99614720', column_count: '6' },
          { tablename: 'users', size_pretty: '180 MB', size_bytes: '188743680', column_count: '12' },
          { tablename: 'user_profiles', size_pretty: '95 MB', size_bytes: '99614720', column_count: '8' },
          { tablename: 'opinioni', size_pretty: '120 MB', size_bytes: '125829120', column_count: '10' },
          { tablename: 'voti_capo_stato', size_pretty: '85 MB', size_bytes: '89128960', column_count: '6' },
          { tablename: 'performance_metrics', size_pretty: '45 MB', size_bytes: '47185920', column_count: '5' },
          { tablename: 'access_audit', size_pretty: '120 MB', size_bytes: '125829120', column_count: '7' },
          { tablename: 'audit_logs', size_pretty: '85 MB', size_bytes: '89128960', column_count: '6' },
          { tablename: 'candidati', size_pretty: '45 MB', size_bytes: '47185920', column_count: '8' },
          { tablename: 'elezioni', size_pretty: '25 MB', size_bytes: '26214400', column_count: '5' },
          { tablename: 'health_checks', size_pretty: '25 MB', size_bytes: '26214400', column_count: '4' },
          { tablename: 'migrations', size_pretty: '15 MB', size_bytes: '15728640', column_count: '3' },
          { tablename: 'sessions', size_pretty: '35 MB', size_bytes: '36700160', column_count: '4' },
          { tablename: 'cache', size_pretty: '20 MB', size_bytes: '20971520', column_count: '3' },
          { tablename: 'notifications', size_pretty: '25 MB', size_bytes: '26214400', column_count: '5' },
          { tablename: 'settings', size_pretty: '10 MB', size_bytes: '10485760', column_count: '4' }
        ]
      };
    }
    
    // Categorizza le tabelle
    const exportableTables = [
      'centralized_logs', 'security_events', 'performance_metrics', 
      'health_checks', 'access_audit', 'audit_logs'
    ];
    
    const analysis = {
      totalDatabaseSizeMB: totalDbSizeMB,
      totalDatabaseSizePretty: totalDbSizePretty,
      isDemoData: totalDbSizeMB === 1250, // Indica se sono dati di demo
      categories: {
        exportable: {
          name: 'Tabelle da Esportare',
          tables: [],
          totalSizeMB: 0,
          color: '#ef4444' // rosso
        },
        users: {
          name: 'Dati Utenti',
          tables: [],
          totalSizeMB: 0,
          color: '#3b82f6' // blu
        },
        content: {
          name: 'Contenuti App',
          tables: [],
          totalSizeMB: 0,
          color: '#10b981' // verde
        },
        system: {
          name: 'Sistema',
          tables: [],
          totalSizeMB: 0,
          color: '#f59e0b' // arancione
        },
        other: {
          name: 'Altro',
          tables: [],
          totalSizeMB: 0,
          color: '#6b7280' // grigio
        }
      }
    };

    // Categorizza ogni tabella
    for (const table of tablesResult.rows) {
      const tableSizeMB = Math.round(parseInt(table.size_bytes) / 1024 / 1024);
      const tableInfo = {
        name: table.tablename,
        sizeMB: tableSizeMB,
        sizePretty: table.size_pretty,
        columnCount: parseInt(table.column_count)
      };

      if (exportableTables.includes(table.tablename)) {
        analysis.categories.exportable.tables.push(tableInfo);
        analysis.categories.exportable.totalSizeMB += tableSizeMB;
      } else if (table.tablename.includes('user') || table.tablename.includes('auth') || table.tablename.includes('profile')) {
        analysis.categories.users.tables.push(tableInfo);
        analysis.categories.users.totalSizeMB += tableSizeMB;
      } else if (table.tablename.includes('opinion') || table.tablename.includes('vote') || table.tablename.includes('candidate') || table.tablename.includes('election')) {
        analysis.categories.content.tables.push(tableInfo);
        analysis.categories.content.totalSizeMB += tableSizeMB;
      } else if (table.tablename.includes('migration') || table.tablename.includes('session') || table.tablename.includes('cache')) {
        analysis.categories.system.tables.push(tableInfo);
        analysis.categories.system.totalSizeMB += tableSizeMB;
      } else {
        analysis.categories.other.tables.push(tableInfo);
        analysis.categories.other.totalSizeMB += tableSizeMB;
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
