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
