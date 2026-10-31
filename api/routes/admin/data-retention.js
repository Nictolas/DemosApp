/**
 * API endpoints per la gestione della data retention
 */

const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const DataRetentionService = require('../../services/dataRetentionService');
const dataRetentionJob = require('../../jobs/dataRetentionJob');

const router = express.Router();

function respondRetentionCleanupError(res, error) {
  if (error?.code === 'RETENTION_POLICY_NOT_APPROVED') {
    console.warn('RETENTION_CLEANUP_POLICY_NOT_APPROVED');
    return res.status(409).json({ success: false, error: 'RETENTION_POLICY_NOT_APPROVED' });
  }
  console.error('RETENTION_CLEANUP_FAILED');
  return res.status(500).json({ success: false, error: 'Errore interno del server' });
}


// A result with category-level errors can mean that some records have already
// changed. Never report completion or expose raw SQL/provider error messages.
// A retry is unsafe until an administrator reconciles the partial outcome.
function respondRetentionCleanupResult(res, result, message, extraData = {}) {
  const validResult =
    result &&
    Array.isArray(result.errors) &&
    Number.isSafeInteger(result.totalDeleted) &&
    result.totalDeleted >= 0 &&
    result.deletedCounts &&
    typeof result.deletedCounts === 'object' &&
    !Array.isArray(result.deletedCounts);

  if (!validResult) {
    console.error('RETENTION_CLEANUP_INVALID_RESULT');
    return res.status(500).json({
      success: false,
      error: 'RETENTION_CLEANUP_FAILED',
      reconciliation_required: true
    });
  }

  if (result.errors.length > 0) {
    console.warn('RETENTION_CLEANUP_PARTIAL_FAILURE');
    return res.status(500).json({
      success: false,
      error: 'RETENTION_PARTIAL_FAILURE',
      reconciliation_required: true
    });
  }

  return res.json({
    success: true,
    message,
    data: {
      ...extraData,
      deleted_counts: result.deletedCounts,
      total_deleted: result.totalDeleted,
      errors: []
    }
  });
}

// Middleware per tutti gli endpoint
router.use(verifyToken);
router.use(requireAdmin);

/**
 * GET /api/admin/data-retention/policies
 * Ottiene le policy di retention configurate
 */
router.get('/policies', async (req, res) => {
  try {
    const policies = DataRetentionService.getRetentionPolicies();
    
    res.json({
      success: true,
      data: {
        policies,
        total_policies: Object.keys(policies).length
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero policy retention:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/data-retention/stats
 * Ottiene statistiche di data retention
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await DataRetentionService.getRetentionStats();
    
    res.json({
      success: true,
      data: {
        stats,
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche retention:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/data-retention/expired/:userId
 * Identifica dati scaduti per un utente specifico
 */
router.get('/expired/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const expiredData = await DataRetentionService.identifyExpiredData(userId);
    
    res.json({
      success: true,
      data: {
        user_id: userId,
        expired_data: expiredData,
        total_types: expiredData.length
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'identificazione dati scaduti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * DELETE /api/admin/data-retention/cleanup/:userId
 * Cancella dati scaduti per un utente specifico
 */
router.delete('/cleanup/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dataTypes } = req.body; // Array opzionale di tipi di dati da cancellare
    
    const result = await DataRetentionService.deleteExpiredData(userId, dataTypes);
    
    return respondRetentionCleanupResult(
      res, result, `Pulizia completata per utente ${userId}`, { user_id: userId }
    );
    
  } catch (error) {
    return respondRetentionCleanupError(res, error);
  }
});

/**
 * POST /api/admin/data-retention/cleanup-all
 * Cancella dati scaduti per tutti gli utenti
 */
router.post('/cleanup-all', async (req, res) => {
  try {
    const { dataTypes } = req.body; // Array opzionale di tipi di dati da cancellare
    
    const result = await DataRetentionService.deleteAllExpiredData(dataTypes);
    
    return respondRetentionCleanupResult(res, result, 'Pulizia completa eseguita');
    
  } catch (error) {
    return respondRetentionCleanupError(res, error);
  }
});

/**
 * GET /api/admin/data-retention/notifications
 * Ottiene notifiche di retention da inviare
 */
router.get('/notifications', async (req, res) => {
  try {
    const { daysBefore = 30 } = req.query;
    
    const notifications = await DataRetentionService.sendRetentionNotifications(parseInt(daysBefore));
    
    res.json({
      success: true,
      data: {
        notifications,
        count: notifications.length,
        days_before: parseInt(daysBefore)
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero notifiche retention:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/data-retention/job/start
 * Avvia il job di data retention
 */
router.post('/job/start', async (req, res) => {
  try {
    DataRetentionService.assertRetentionPolicyApproved();
    dataRetentionJob.start();
    
    res.json({
      success: true,
      message: 'Job di data retention avviato',
      data: {
        status: dataRetentionJob.getStatus()
      }
    });
    
  } catch (error) {
    return respondRetentionCleanupError(res, error);
  }
});

/**
 * POST /api/admin/data-retention/job/stop
 * Ferma il job di data retention
 */
router.post('/job/stop', async (req, res) => {
  try {
    dataRetentionJob.stop();
    
    res.json({
      success: true,
      message: 'Job di data retention fermato',
      data: {
        status: dataRetentionJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'arresto job retention:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/data-retention/job/status
 * Ottiene lo stato del job di data retention
 */
router.get('/job/status', async (req, res) => {
  try {
    const status = dataRetentionJob.getStatus();
    
    res.json({
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero stato job:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/data-retention/cleanup/immediate
 * Esegue pulizia immediata
 */
router.post('/cleanup/immediate', async (req, res) => {
  try {
    const result = await dataRetentionJob.performImmediateCleanup();
    
    return respondRetentionCleanupResult(res, result, 'Pulizia immediata completata');
    
  } catch (error) {
    return respondRetentionCleanupError(res, error);
  }
});

module.exports = router;
