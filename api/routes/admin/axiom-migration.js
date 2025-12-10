// Endpoint per migrare dati da Neon a Axiom
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/auth');

// Le funzioni di migrazione vengono caricate solo quando necessario (lazy loading)
// per evitare errori all'avvio se 'pg' non è disponibile

/**
 * POST /api/admin/axiom-migration/migrate
 * Avvia migrazione dati da Neon a Axiom
 * Richiede autenticazione admin
 */
router.post('/migrate', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tables, dryRun } = req.body;
    
    // Verifica configurazione Axiom
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'Imposta AXIOM_ENABLED=true per abilitare la migrazione'
      });
    }
    
    if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
      return res.status(400).json({
        success: false,
        error: 'Axiom non configurato',
        message: 'Configura AXIOM_API_TOKEN e AXIOM_ORG_ID'
      });
    }
    
    // Usa il servizio di migrazione invece dello script esterno
    // Questo evita problemi con il modulo 'pg' su Render
    const { migrateNeonToAxiom } = require('../../services/axiomMigrationService');
    
    // Avvia migrazione in background (non blocca la risposta)
    const migrationPromise = migrateNeonToAxiom({
      tables: tables || ['centralized_logs', 'audit_logs'],
      dryRun: dryRun || false
    });
    
    // Rispondi immediatamente
    res.json({
      success: true,
      message: 'Migrazione avviata in background',
      tables: tables || ['centralized_logs', 'audit_logs'],
      dryRun: dryRun || false
    });
    
    // Esegui migrazione in background
    migrationPromise
      .then(results => {
        console.log('✅ Migrazione completata:', results);
      })
      .catch(error => {
        console.error('❌ Errore migrazione:', error);
      });
    
  } catch (error) {
    console.error('❌ Errore avvio migrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore avvio migrazione',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/axiom-migration/status
 * Ottiene statistiche sui dati da migrare (dry-run)
 */
router.get('/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const stats = {};
    
    // Conta centralized_logs
    try {
      const centralizedCount = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
      stats.centralized_logs = {
        total: parseInt(centralizedCount.rows[0].count),
        table: 'centralized_logs',
        destination: process.env.AXIOM_DATASET || 'centralized_logs'
      };
    } catch (error) {
      stats.centralized_logs = { error: error.message };
    }
    
    // Conta audit_logs
    try {
      // Verifica quale tabella usare
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'audit_logs_compressed'
        )
      `);
      
      const tableName = tableCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
      const auditCount = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      
      stats.audit_logs = {
        total: parseInt(auditCount.rows[0].count),
        table: tableName,
        destination: process.env.AXIOM_REALTIME_DATASET || 'real-time'
      };
    } catch (error) {
      stats.audit_logs = { error: error.message };
    }
    
    await pool.end();
    
    res.json({
      success: true,
      stats,
      axiomConfig: {
        enabled: process.env.AXIOM_ENABLED === 'true',
        hasToken: !!process.env.AXIOM_API_TOKEN,
        hasOrgId: !!process.env.AXIOM_ORG_ID,
        dataset: process.env.AXIOM_DATASET || 'centralized_logs',
        realtimeDataset: process.env.AXIOM_REALTIME_DATASET || 'real-time'
      }
    });
    
  } catch (error) {
    console.error('❌ Errore recupero statistiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero statistiche',
      message: error.message
    });
  }
});

module.exports = router;

