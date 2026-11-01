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
    /** Riduci carico DB: intervalli configurabili (ms), default 24h / 7 giorni */
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
        console.error('RETENTION_DAILY_CLEANUP_UNHANDLED');
      });
    }, this.cleanupIntervalMs);

    this.notificationInterval = setInterval(() => {
      Promise.resolve(this.sendWeeklyNotifications()).catch(error => {
        console.error('RETENTION_CANDIDATE_SCAN_UNHANDLED');
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
      console.error('RETENTION_DAILY_CLEANUP_FAILED');
      
      // Log dell'errore
      await AuditService.logAction({
        userId: 'system',
        action: 'DATA_RETENTION_DAILY_CLEANUP',
        resource: 'all',
        details: {
          error_code: 'RETENTION_DAILY_CLEANUP_FAILED',
          cleanup_date: new Date()
        },
        success: false,
        errorMessage: 'RETENTION_DAILY_CLEANUP_FAILED'
      });
    }
  }

  /**
   * Scansione settimanale dei candidati a notifiche di retention.
   * Il nome pubblico e mantenuto per compatibilita, ma NON viene effettuato un invio.
   */
  async sendWeeklyNotifications() {
    try {
      console.log('Scansione settimanale candidati notifiche retention (nessun invio)');
      
      const notifications = await DataRetentionService.sendRetentionNotifications(30);
      
      if (notifications.length > 0) {
        console.log(`Candidati notifiche retention individuati: ${notifications.length} (inviate: 0)`);
        
        // Log delle notifiche
        await AuditService.logAction({
          userId: 'system',
          action: 'DATA_RETENTION_NOTIFICATION_CANDIDATE_SCAN',
          resource: 'retention_candidates',
          details: {
            candidate_count: notifications.length,
            sent_count: 0,
            delivery_performed: false,
            scan_date: new Date()
          },
          // Success means candidate enumeration succeeded, not notification delivery.
          success: true
        });
      } else {
        console.log('Nessun candidato a notifiche retention individuato (inviate: 0)');
      }

    } catch (error) {
      console.error('RETENTION_CANDIDATE_SCAN_FAILED');
      
      // La registrazione audit e best-effort: non propagare un secondo errore grezzo.
      try {
        // Log dell'errore
        await AuditService.logAction({
          userId: 'system',
          action: 'DATA_RETENTION_NOTIFICATION_CANDIDATE_SCAN',
          resource: 'retention_candidates',
          details: {
            error_code: 'RETENTION_CANDIDATE_SCAN_FAILED',
            sent_count: 0,
            delivery_performed: false,
            scan_date: new Date()
          },
          success: false,
          errorMessage: 'RETENTION_CANDIDATE_SCAN_FAILED'
        });
      } catch (_auditError) {
        console.error('RETENTION_CANDIDATE_AUDIT_FAILED');
      }
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
      console.error('RETENTION_IMMEDIATE_CLEANUP_FAILED');
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
