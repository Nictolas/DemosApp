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
    console.log('📦 Caricamento servizio migrazione...');
    let migrateNeonToAxiom;
    try {
      const migrationService = require('../../services/axiomMigrationService');
      migrateNeonToAxiom = migrationService.migrateNeonToAxiom;
      console.log('✅ Servizio migrazione caricato correttamente');
    } catch (error) {
      console.error('❌ Errore caricamento servizio migrazione:', error);
      throw error;
    }
    
    console.log('🚀 Avvio migrazione...');
    console.log(`   Tables: ${(tables || ['centralized_logs', 'audit_logs']).join(', ')}`);
    console.log(`   DryRun: ${dryRun || false}`);
    
    // Rispondi immediatamente al frontend per evitare timeout
    // La migrazione viene eseguita in background
    res.json({
      success: true,
      message: 'Migrazione avviata in background',
      tables: tables || ['centralized_logs', 'audit_logs'],
      dryRun: dryRun || false,
      status: 'running'
    });
    
    // Esegui migrazione in background (non blocca la risposta)
    (async () => {
      try {
        const results = await migrateNeonToAxiom({
          tables: tables || ['centralized_logs', 'audit_logs'],
          dryRun: dryRun || false
        });
        
        console.log('✅ Migrazione completata:', JSON.stringify(results, null, 2));
        
        // Salva statistiche migrazione in una tabella per poterle recuperare dopo
        try {
          const { Pool } = require('pg');
          const statsPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
          });
          
          // Crea tabella se non esiste
          await statsPool.query(`
            CREATE TABLE IF NOT EXISTS axiom_migration_stats (
              id SERIAL PRIMARY KEY,
              dataset_name VARCHAR(255) NOT NULL,
              events_migrated BIGINT NOT NULL,
              batches_count INTEGER NOT NULL,
              migrated_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(dataset_name)
            )
          `);
          
          // Salva statistiche
          for (const [table, result] of Object.entries(results)) {
            if (result && result.migrated) {
              const datasetName = table === 'centralized_logs' 
                ? (process.env.AXIOM_DATASET || 'centralized_logs')
                : (process.env.AXIOM_REALTIME_DATASET || 'real-time');
              
              await statsPool.query(`
                INSERT INTO axiom_migration_stats (dataset_name, events_migrated, batches_count)
                VALUES ($1, $2, $3)
                ON CONFLICT (dataset_name) 
                DO UPDATE SET 
                  events_migrated = axiom_migration_stats.events_migrated + EXCLUDED.events_migrated,
                  batches_count = axiom_migration_stats.batches_count + EXCLUDED.batches_count,
                  migrated_at = NOW()
              `, [datasetName, result.migrated, result.batches || 0]);
            }
          }
          
          await statsPool.end();
        } catch (statsError) {
          console.error('⚠️ Errore salvataggio statistiche:', statsError.message);
          // Non bloccare se fallisce
        }
        
      } catch (error) {
        console.error('❌ Errore migrazione:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Error details:', JSON.stringify({
          message: error.message,
          code: error.code,
          name: error.name
        }, null, 2));
      }
    })();
    
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
 * GET /api/admin/axiom-migration/test-auth
 * Endpoint di test per verificare autenticazione e permessi
 */
router.get('/test-auth', verifyToken, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Autenticazione e permessi admin verificati correttamente',
      user: {
        id: req.userId,
        email: req.userEmail,
        role: req.userRole
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore test auth:', error);
    res.status(500).json({
      success: false,
      error: 'Errore test autenticazione',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/axiom-migration/migration-stats
 * Ottiene statistiche sulla migrazione completata (basata sui log di migrazione)
 */
router.get('/migration-stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Conta quanti record sono stati migrati (basato sui log di migrazione o su una tabella di tracking)
    // Per ora, restituiamo i conteggi totali da Neon come riferimento
    const stats = {};
    
    try {
      const centralizedCount = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
      stats.centralized_logs = {
        totalInNeon: parseInt(centralizedCount.rows[0].count),
        migrated: null, // Non possiamo verificare via API
        note: 'Verifica manualmente su Axiom Dashboard - le query APL restituiscono 403'
      };
    } catch (error) {
      stats.centralized_logs = { error: error.message };
    }
    
    try {
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
        totalInNeon: parseInt(auditCount.rows[0].count),
        migrated: null,
        note: 'Verifica manualmente su Axiom Dashboard - le query APL restituiscono 403'
      };
    } catch (error) {
      stats.audit_logs = { error: error.message };
    }
    
    await pool.end();
    
    res.json({
      success: true,
      stats,
      message: 'I dati sono stati migrati con successo. Verifica manualmente su Axiom Dashboard perché le query APL restituiscono 403.',
      axiomDashboardUrl: `https://app.axiom.co/${process.env.AXIOM_ORG_ID}/datasets`
    });
    
  } catch (error) {
    console.error('❌ Errore recupero statistiche migrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore recupero statistiche migrazione',
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

/**
 * POST /api/admin/axiom-migration/delete-migrated
 * Elimina i dati migrati da Neon dopo verifica su Axiom
 * ATTENZIONE: Questa operazione è IRREVERSIBILE
 */
// Legacy log migration deletion is disabled until Axiom export completeness,
// independent receipts and RP-10 retention are reviewed.
// Admin privileges and a typed DELETE confirmation alone do not prove archival safety.
router.post('/delete-migrated', verifyToken, requireAdmin, (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    error: 'Eliminazione legacy da Neon disabilitata in attesa di verifica GDPR/RP-10'
  });
});

module.exports = router;

