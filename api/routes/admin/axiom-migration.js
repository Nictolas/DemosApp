// Endpoint per migrare dati da Neon a Axiom
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/auth');

// Nessuna migrazione di log legacy viene avviata da questo router.

/**
 * POST /api/admin/axiom-migration/migrate
 * Avvia migrazione dati da Neon a Axiom
 * Richiede autenticazione admin
 */
router.post('/migrate', verifyToken, requireAdmin, (_req, res) => {
  // Legacy migration can transfer user IDs, emails, IP addresses and free-form
  // audit details. Optional anonymization and an unapproved retention matrix
  // cannot certify such a transfer; reject before loading services or writing DB.
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    error: 'Migrazione legacy verso Axiom sospesa: verifica GDPR e minimizzazione necessarie'
  });
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
 * Azione legacy ritirata: non eliminare dati senza prove indipendenti di
 * archivio completo, retention approvata e percorso offline autorizzato.
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

