/**
 * Job automatico per la gestione della data retention
 * Esegue pulizia automatica dei dati scaduti
 */

const DataRetentionService = require('../services/dataRetentionService');
const AuditService = require('../services/auditService');

class DataRetentionJob {
  constructor() {
    this.isRunning = false;
    this.cleanupInterval = null;
    this.notificationInterval = null;
    /** Riduci wake su Neon: intervalli configurabili (ms), default 24h / 7 giorni */
    this.cleanupIntervalMs = Math.max(
      60 * 60 * 1000,
      parseInt(process.env.DATA_RETENTION_CLEANUP_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10)
    );
    this.notificationIntervalMs = Math.max(
      60 * 60 * 1000,
      parseInt(process.env.DATA_RETENTION_NOTIFICATION_INTERVAL_MS || String(7 * 24 * 60 * 60 * 1000), 10)
    );
  }

  /**
   * Avvia il job di data retention
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Job di data retention già in esecuzione');
      return;
    }

    console.log('🚀 Avvio job di data retention...');
    this.isRunning = true;

    this.cleanupInterval = setInterval(() => {
      Promise.resolve(this.performDailyCleanup()).catch(error => {
        console.error('❌ Errore non gestito in performDailyCleanup():', error);
      });
    }, this.cleanupIntervalMs);

    this.notificationInterval = setInterval(() => {
      Promise.resolve(this.sendWeeklyNotifications()).catch(error => {
        console.error('❌ Errore non gestito in sendWeeklyNotifications():', error);
      });
    }, this.notificationIntervalMs);

    console.log(
      `✅ Job di data retention avviato (cleanup ogni ${this.cleanupIntervalMs} ms, notifiche ogni ${this.notificationIntervalMs} ms)`
    );
  }

  /**
   * Ferma il job di data retention
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Job di data retention non in esecuzione');
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = null;
    }

    this.isRunning = false;
    console.log('🛑 Job di data retention fermato');
  }

  /**
   * Esegue pulizia giornaliera
   */
  async performDailyCleanup() {
    try {
      console.log('🧹 Esecuzione pulizia giornaliera dati scaduti...');
      
      const result = await DataRetentionService.performFullCleanup();
      
      console.log(`✅ Pulizia giornaliera completata: ${result.totalDeleted} record cancellati`);
      
      // Log dell'operazione
      await AuditService.logAction({
        userId: 'system',
        action: 'DATA_RETENTION_DAILY_CLEANUP',
        resource: 'all',
        details: {
          deleted_counts: result.deletedCounts,
          total_deleted: result.totalDeleted,
          errors: result.errors,
          cleanup_date: new Date()
        },
        success: result.errors.length === 0
      });

    } catch (error) {
      console.error('❌ Errore nella pulizia giornaliera:', error);
      
      // Log dell'errore
      await AuditService.logAction({
        userId: 'system',
        action: 'DATA_RETENTION_DAILY_CLEANUP',
        resource: 'all',
        details: {
          error: error.message,
          cleanup_date: new Date()
        },
        success: false,
        errorMessage: error.message
      });
    }
  }

  /**
   * Invia notifiche settimanali
   */
  async sendWeeklyNotifications() {
    try {
      console.log('📧 Invio notifiche settimanali data retention...');
      
      const notifications = await DataRetentionService.sendRetentionNotifications(30);
      
      if (notifications.length > 0) {
        console.log(`📧 Inviate ${notifications.length} notifiche di retention`);
        
        // Log delle notifiche
        await AuditService.logAction({
          userId: 'system',
          action: 'DATA_RETENTION_NOTIFICATIONS',
          resource: 'notifications',
          details: {
            notification_count: notifications.length,
            notification_date: new Date()
          },
          success: true
        });
      } else {
        console.log('✅ Nessuna notifica di retention da inviare');
      }

    } catch (error) {
      console.error('❌ Errore nell\'invio notifiche:', error);
      
      // Log dell'errore
      await AuditService.logAction({
        userId: 'system',
        action: 'DATA_RETENTION_NOTIFICATIONS',
        resource: 'notifications',
        details: {
          error: error.message,
          notification_date: new Date()
        },
        success: false,
        errorMessage: error.message
      });
    }
  }

  /**
   * Esegue pulizia immediata
   */
  async performImmediateCleanup() {
    try {
      console.log('🧹 Esecuzione pulizia immediata...');
      
      const result = await DataRetentionService.performFullCleanup();
      
      console.log(`✅ Pulizia immediata completata: ${result.totalDeleted} record cancellati`);
      
      return result;
    } catch (error) {
      console.error('❌ Errore nella pulizia immediata:', error);
      throw error;
    }
  }

  /**
   * Ottiene lo stato del job
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasCleanupInterval: this.cleanupInterval !== null,
      hasNotificationInterval: this.notificationInterval !== null
    };
  }
}

// Istanza singleton
const dataRetentionJob = new DataRetentionJob();

module.exports = dataRetentionJob;
