/**
 * API endpoints per la gestione delle violazioni e notifiche
 */

const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const ViolationDetectionService = require('../../services/violationDetectionService');
const NotificationService = require('../../services/notificationService');
const violationMonitoringJob = require('../../jobs/violationMonitoringJob');

const router = express.Router();

// Middleware per tutti gli endpoint
router.use(verifyToken);
router.use(requireAdmin);

/**
 * GET /api/admin/violations/types
 * Ottiene i tipi di violazioni rilevabili
 */
router.get('/types', async (req, res) => {
  try {
    const violationTypes = ViolationDetectionService.getViolationTypes();
    
    res.json({
      success: true,
      data: {
        types: violationTypes,
        total_types: Object.keys(violationTypes).length
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero tipi violazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/violations/detect
 * Esegue rilevamento manuale delle violazioni
 */
router.get('/detect', async (req, res) => {
  try {
    const detectionResult = await ViolationDetectionService.detectAllViolations();
    
    res.json({
      success: true,
      data: {
        detection_result: detectionResult,
        detected_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel rilevamento violazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/violations/security
 * Rileva specificamente violazioni di sicurezza
 */
router.get('/security', async (req, res) => {
  try {
    const securityViolations = await ViolationDetectionService.detectSecurityViolations();
    
    res.json({
      success: true,
      data: {
        violations: securityViolations,
        count: securityViolations.length,
        detected_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel rilevamento violazioni sicurezza:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/violations/gdpr
 * Rileva specificamente violazioni GDPR
 */
router.get('/gdpr', async (req, res) => {
  try {
    const gdprViolations = await ViolationDetectionService.detectGDPRViolations();
    
    res.json({
      success: true,
      data: {
        violations: gdprViolations,
        count: gdprViolations.length,
        detected_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel rilevamento violazioni GDPR:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/violations/notify
 * Invia notifica manuale per una violazione
 */
router.post('/notify', async (req, res) => {
  try {
    const { violation, notificationType } = req.body;
    
    if (!violation || !notificationType) {
      return res.status(400).json({
        success: false,
        error: 'Violazione e tipo notifica richiesti'
      });
    }
    
    let result;
    
    switch (notificationType) {
      case 'critical':
        result = await NotificationService.sendCriticalViolationNotification(violation);
        break;
      case 'security':
        result = await NotificationService.sendSecurityBreachNotification(violation);
        break;
      case 'gdpr':
        result = await NotificationService.sendGDPRViolationNotification(violation);
        break;
      case 'system':
        result = await NotificationService.sendSystemAlertNotification(violation);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Tipo notifica non valido'
        });
    }
    
    res.json({
      success: true,
      message: 'Notifica inviata con successo',
      data: {
        notification_type: notificationType,
        result: result
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'invio notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/violations/escalate
 * Invia notifica di escalation
 */
router.post('/escalate', async (req, res) => {
  try {
    const { violation, escalationLevel } = req.body;
    
    if (!violation || !escalationLevel) {
      return res.status(400).json({
        success: false,
        error: 'Violazione e livello escalation richiesti'
      });
    }
    
    const result = await NotificationService.sendEscalationNotification(violation, escalationLevel);
    
    res.json({
      success: true,
      message: 'Notifica escalation inviata con successo',
      data: {
        escalation_level: escalationLevel,
        result: result
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'invio escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/violations/monitoring/start
 * Avvia il job di monitoraggio
 */
router.post('/monitoring/start', async (req, res) => {
  try {
    violationMonitoringJob.start();
    
    res.json({
      success: true,
      message: 'Job di monitoraggio violazioni avviato',
      data: {
        status: violationMonitoringJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'avvio monitoraggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/violations/monitoring/stop
 * Ferma il job di monitoraggio
 */
router.post('/monitoring/stop', async (req, res) => {
  try {
    violationMonitoringJob.stop();
    
    res.json({
      success: true,
      message: 'Job di monitoraggio violazioni fermato',
      data: {
        status: violationMonitoringJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'arresto monitoraggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/violations/monitoring/status
 * Ottiene lo stato del job di monitoraggio
 */
router.get('/monitoring/status', async (req, res) => {
  try {
    const status = violationMonitoringJob.getStatus();
    
    res.json({
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero stato monitoraggio:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/violations/monitoring/immediate
 * Esegue monitoraggio immediato
 */
router.post('/monitoring/immediate', async (req, res) => {
  try {
    await violationMonitoringJob.performImmediateMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoraggio immediato completato',
      data: {
        status: violationMonitoringJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel monitoraggio immediato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/admin/violations/reset-counters
 * Reset dei contatori violazioni
 */
router.post('/reset-counters', async (req, res) => {
  try {
    violationMonitoringJob.resetCounters();
    
    res.json({
      success: true,
      message: 'Contatori violazioni resettati',
      data: {
        status: violationMonitoringJob.getStatus()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel reset contatori:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * GET /api/admin/violations/notifications/config
 * Ottiene la configurazione delle notifiche
 */
router.get('/notifications/config', async (req, res) => {
  try {
    const config = NotificationService.getNotificationConfig();
    
    res.json({
      success: true,
      data: {
        config,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero configurazione notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
