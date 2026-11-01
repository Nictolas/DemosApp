/**
 * API endpoints per la gestione della data retention
 */

const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const DataRetentionService = require('../../services/dataRetentionService');
const dataRetentionJob = require('../../jobs/dataRetentionJob');

const router = express.Router();

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
    console.error('RETENTION_POLICIES_READ_FAILED');
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
    console.error('RETENTION_STATS_READ_FAILED');
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
    console.error('RETENTION_EXPIRED_DATA_LOOKUP_FAILED');
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
    
    res.json({
      success: true,
      message: `Pulizia completata per utente ${userId}`,
      data: {
        user_id: userId,
        deleted_counts: result.deletedCounts,
        total_deleted: result.totalDeleted,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error('RETENTION_USER_CLEANUP_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
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
    
    res.json({
      success: true,
      message: 'Pulizia completa eseguita',
      data: {
        deleted_counts: result.deletedCounts,
        total_deleted: result.totalDeleted,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error('RETENTION_ALL_CLEANUP_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/data-retention/notifications
 * Ottiene solo i candidati a una futura notifica di retention (nessun invio)
 */
router.get('/notifications', async (req, res) => {
  try {
    const { daysBefore = 30 } = req.query;
    
    const notifications = await DataRetentionService.sendRetentionNotifications(parseInt(daysBefore));
    
    res.json({
      success: true,
      data: {
        notifications, // Alias legacy: questi record sono candidati, non invii effettuati.
        count: notifications.length, // Alias legacy del conteggio candidati.
        candidate_count: notifications.length,
        sent_count: 0,
        delivery_performed: false,
        delivery_status: 'not_sent',
        days_before: parseInt(daysBefore)
      }
    });
    
  } catch (error) {
    console.error('RETENTION_NOTIFICATION_CANDIDATES_FAILED');
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
    dataRetentionJob.start();
    
    res.json({
      success: true,
      message: 'Job di data retention avviato',
      data: {
        status: dataRetentionJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('RETENTION_JOB_START_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
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
    console.error('RETENTION_JOB_STOP_FAILED');
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
    console.error('RETENTION_JOB_STATUS_FAILED');
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
    
    res.json({
      success: true,
      message: 'Pulizia immediata completata',
      data: {
        deleted_counts: result.deletedCounts,
        total_deleted: result.totalDeleted,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error('RETENTION_IMMEDIATE_API_FAILED');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
