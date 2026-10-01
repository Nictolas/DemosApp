/**
 * API endpoints per la gestione del backup e recovery
 */

const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const BackupService = require('../../services/backupService');
const backupJob = require('../../jobs/backupJob');

const router = express.Router();

// Middleware per tutti gli endpoint
router.use(verifyToken);
router.use(requireAdmin);

/**
 * GET /api/admin/backup/stats
 * Ottiene statistiche sui backup
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await BackupService.getBackupStats();
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche backup:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/backup/list
 * Ottiene lista dei backup disponibili
 */
router.get('/list', async (req, res) => {
  try {
    const backups = await BackupService.getBackupList();
    
    res.json({
      success: true,
      data: {
        backups,
        count: backups.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero lista backup:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/create/full
 * Crea backup completo
 */
router.post('/create/full', async (req, res) => {
  try {
    const result = await BackupService.createFullBackup();
    
    res.json({
      success: true,
      message: 'Backup completo creato con successo',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Errore nella creazione backup completo:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/create/incremental
 * Crea backup incrementale
 */
router.post('/create/incremental', async (req, res) => {
  try {
    const result = await BackupService.createIncrementalBackup();
    
    res.json({
      success: true,
      message: 'Backup incrementale creato con successo',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Errore nella creazione backup incrementale:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/restore/:fileName
 * Ripristina database da backup
 */
router.post('/restore/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'Nome file backup richiesto'
      });
    }
    
    const result = await BackupService.restoreFromBackup(fileName);
    
    res.json({
      success: true,
      message: 'Database ripristinato con successo',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Errore nel ripristino backup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/backup/verify/:fileName
 * Verifica integrità di un backup
 */
router.get('/verify/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'Nome file backup richiesto'
      });
    }
    
    const config = BackupService.getBackupConfig();
    const path = require('path');
    const backupRoot = path.resolve(config.backupDir);
    const normalizedFileName = path.basename(fileName);

    if (normalizedFileName !== fileName || !/^[A-Za-z0-9._-]+$/.test(normalizedFileName)) {
      return res.status(400).json({
        success: false,
        error: 'Nome file backup non valido'
      });
    }

    const backupPath = path.resolve(backupRoot, normalizedFileName);
    const relativeBackupPath = path.relative(backupRoot, backupPath);
    if (relativeBackupPath.startsWith('..') || path.isAbsolute(relativeBackupPath)) {
      return res.status(400).json({
        success: false,
        error: 'Percorso backup non consentito'
      });
    }
    
    const isValid = await BackupService.verifyBackupIntegrity(backupPath);
    
    res.json({
      success: true,
      data: {
        fileName,
        isValid,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica backup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/cleanup
 * Pulisce backup vecchi
 */
router.post('/cleanup', async (req, res) => {
  try {
    await BackupService.cleanupOldBackups();
    
    res.json({
      success: true,
      message: 'Pulizia backup completata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nella pulizia backup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/job/start
 * Avvia il job di backup automatico
 */
router.post('/job/start', async (req, res) => {
  try {
    backupJob.start();
    
    res.json({
      success: true,
      message: 'Job di backup automatico avviato',
      data: {
        status: backupJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'avvio job backup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/job/stop
 * Ferma il job di backup automatico
 */
router.post('/job/stop', async (req, res) => {
  try {
    backupJob.stop();
    
    res.json({
      success: true,
      message: 'Job di backup automatico fermato',
      data: {
        status: backupJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'arresto job backup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/backup/job/status
 * Ottiene lo stato del job di backup
 */
router.get('/job/status', async (req, res) => {
  try {
    const status = backupJob.getStatus();
    
    res.json({
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero stato job backup:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/job/immediate
 * Esegue backup immediato
 */
router.post('/job/immediate', async (req, res) => {
  try {
    const { type = 'full' } = req.body;
    
    if (!['full', 'incremental'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo backup non valido. Usa "full" o "incremental"'
      });
    }
    
    const result = await backupJob.performImmediateBackup(type);
    
    res.json({
      success: true,
      message: `Backup immediato (${type}) completato con successo`,
      data: result
    });
    
  } catch (error) {
    console.error('❌ Errore nel backup immediato:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/backup/test/integrity
 * Esegue test di integrità sui backup
 */
router.post('/test/integrity', async (req, res) => {
  try {
    const result = await backupJob.performIntegrityTest();
    
    res.json({
      success: true,
      message: 'Test di integrità completato',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Errore nel test di integrità:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/backup/config
 * Ottiene la configurazione del backup
 */
router.get('/config', async (req, res) => {
  try {
    const config = BackupService.getBackupConfig();
    
    // Nascondi chiave di crittografia per sicurezza
    const safeConfig = { ...config };
    if (safeConfig.encryptionKey) {
      safeConfig.encryptionKey = '***HIDDEN***';
    }
    
    res.json({
      success: true,
      data: {
        config: safeConfig,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero configurazione backup:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
