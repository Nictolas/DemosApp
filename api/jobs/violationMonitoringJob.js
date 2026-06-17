/**
 * Job automatico per il monitoraggio delle violazioni
 * Esegue rilevamento continuo e invio notifiche
 */

const ViolationDetectionService = require('../services/violationDetectionService');
const NotificationService = require('../services/notificationService');
const AuditService = require('../services/auditService');

class ViolationMonitoringJob {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    this.summaryInterval = null;
    this.violationCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0
    };
    this.lastSummaryDate = new Date().toDateString();
    /** Default 5 min / 24h; aumenta gli intervalli per meno carico sul database */
    this.monitoringIntervalMs = Math.max(
      60 * 1000,
      parseInt(process.env.VIOLATION_MONITORING_INTERVAL_MS || String(5 * 60 * 1000), 10)
    );
    this.summaryIntervalMs = Math.max(
      60 * 60 * 1000,
      parseInt(process.env.VIOLATION_SUMMARY_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10)
    );
  }

  /**
   * Avvia il job di monitoraggio
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Job di monitoraggio violazioni già in esecuzione');
      return;
    }

    console.log('🚀 Avvio job di monitoraggio violazioni...');
    this.isRunning = true;

    this.monitoringInterval = setInterval(() => {
      Promise.resolve(this.performMonitoring()).catch(error => {
        console.error('❌ Errore non gestito in performMonitoring():', error);
      });
    }, this.monitoringIntervalMs);

    this.summaryInterval = setInterval(() => {
      Promise.resolve(this.sendDailySummary()).catch(error => {
        console.error('❌ Errore non gestito in sendDailySummary():', error);
      });
    }, this.summaryIntervalMs);

    console.log(
      `✅ Job di monitoraggio violazioni avviato (scan ogni ${this.monitoringIntervalMs} ms, riepilogo ogni ${this.summaryIntervalMs} ms)`
    );
  }

  /**
   * Ferma il job di monitoraggio
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Job di monitoraggio violazioni non in esecuzione');
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.summaryInterval) {
      clearInterval(this.summaryInterval);
      this.summaryInterval = null;
    }

    this.isRunning = false;
    console.log('🛑 Job di monitoraggio violazioni fermato');
  }

  /**
   * Esegue il monitoraggio delle violazioni
   */
  async performMonitoring() {
    try {
      console.log('🔍 Esecuzione monitoraggio violazioni...');
      
      const detectionResult = await ViolationDetectionService.detectAllViolations();
      
      if (detectionResult.total > 0) {
        console.log(`🚨 Rilevate ${detectionResult.total} violazioni`);
        
        // Processa ogni violazione
        for (const violation of detectionResult.violations) {
          await this.processViolation(violation);
        }
        
        // Aggiorna contatori
        this.violationCounts.CRITICAL += detectionResult.critical;
        this.violationCounts.HIGH += detectionResult.high;
        this.violationCounts.MEDIUM += detectionResult.medium;
      } else {
        console.log('✅ Nessuna violazione rilevata');
      }

    } catch (error) {
      console.error('❌ Errore nel monitoraggio violazioni:', error);
      
      // Invia notifica di errore del sistema
      await this.sendSystemErrorNotification(error);
    }
  }

  /**
   * Processa una singola violazione
   */
  async processViolation(violation) {
    try {
      console.log(`🔍 Processando violazione: ${violation.type} (${violation.severity})`);
      
      // Log della violazione
      await AuditService.logAction({
        userId: 'system',
        action: 'VIOLATION_DETECTED',
        resource: 'violation',
        resourceId: violation.type,
        details: {
          violation_type: violation.type,
          severity: violation.severity,
          description: violation.description,
          details: violation.details,
          timestamp: violation.timestamp
        },
        success: true
      });

      // Invia notifica basata sulla severità
      switch (violation.severity) {
        case 'CRITICAL':
          await this.handleCriticalViolation(violation);
          break;
        case 'HIGH':
          await this.handleHighViolation(violation);
          break;
        case 'MEDIUM':
          await this.handleMediumViolation(violation);
          break;
        default:
          console.log(`⚠️ Severità sconosciuta: ${violation.severity}`);
      }

    } catch (error) {
      console.error('❌ Errore nel processamento violazione:', error);
    }
  }

  /**
   * Gestisce violazioni critiche
   */
  async handleCriticalViolation(violation) {
    try {
      console.log(`🚨 Violazione CRITICA: ${violation.type}`);
      
      // Invia notifica immediata
      await NotificationService.sendCriticalViolationNotification(violation);
      
      // Se è una violazione di sicurezza, invia notifica specifica
      if (violation.type.includes('SECURITY') || violation.type.includes('BREACH')) {
        await NotificationService.sendSecurityBreachNotification(violation);
      }
      
      // Se è una violazione GDPR, invia notifica specifica
      if (violation.type.includes('GDPR') || violation.type.includes('DATA_BREACH')) {
        await NotificationService.sendGDPRViolationNotification(violation);
      }
      
      // Invia escalation immediata
      await NotificationService.sendEscalationNotification(violation, 1);
      
    } catch (error) {
      console.error('❌ Errore nella gestione violazione critica:', error);
    }
  }

  /**
   * Gestisce violazioni ad alta priorità
   */
  async handleHighViolation(violation) {
    try {
      console.log(`⚠️ Violazione HIGH: ${violation.type}`);
      
      // Invia notifica se supera la soglia
      if (this.violationCounts.HIGH >= 3) {
        await NotificationService.sendCriticalViolationNotification(violation);
        this.violationCounts.HIGH = 0; // Reset contatore
      }
      
    } catch (error) {
      console.error('❌ Errore nella gestione violazione high:', error);
    }
  }

  /**
   * Gestisce violazioni a media priorità
   */
  async handleMediumViolation(violation) {
    try {
      console.log(`ℹ️ Violazione MEDIUM: ${violation.type}`);
      
      // Invia notifica se supera la soglia
      if (this.violationCounts.MEDIUM >= 10) {
        await NotificationService.sendCriticalViolationNotification(violation);
        this.violationCounts.MEDIUM = 0; // Reset contatore
      }
      
    } catch (error) {
      console.error('❌ Errore nella gestione violazione medium:', error);
    }
  }

  /**
   * Invia notifica di errore del sistema
   */
  async sendSystemErrorNotification(error) {
    try {
      const systemAlert = {
        type: 'SYSTEM_ERROR',
        component: 'violation_monitoring',
        error: error.message,
        timestamp: new Date(),
        severity: 'HIGH'
      };
      
      await NotificationService.sendSystemAlertNotification(systemAlert);
      
    } catch (notificationError) {
      console.error('❌ Errore nell\'invio notifica errore sistema:', notificationError);
    }
  }

  /**
   * Invia riepilogo giornaliero
   */
  async sendDailySummary() {
    try {
      const today = new Date().toDateString();
      
      if (today === this.lastSummaryDate) {
        return; // Già inviato oggi
      }
      
      console.log('📊 Invio riepilogo giornaliero...');
      
      const summary = {
        date: today,
        total_violations: this.violationCounts.CRITICAL + this.violationCounts.HIGH + this.violationCounts.MEDIUM,
        critical_violations: this.violationCounts.CRITICAL,
        high_violations: this.violationCounts.HIGH,
        medium_violations: this.violationCounts.MEDIUM,
        system_health: this.getSystemHealthStatus()
      };
      
      await NotificationService.sendDailySummaryNotification(summary);
      
      // Reset contatori per il giorno successivo
      this.violationCounts = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0
      };
      
      this.lastSummaryDate = today;
      
      console.log('✅ Riepilogo giornaliero inviato');
      
    } catch (error) {
      console.error('❌ Errore nell\'invio riepilogo giornaliero:', error);
    }
  }

  /**
   * Determina lo stato di salute del sistema
   */
  getSystemHealthStatus() {
    const totalViolations = this.violationCounts.CRITICAL + this.violationCounts.HIGH + this.violationCounts.MEDIUM;
    
    if (this.violationCounts.CRITICAL > 0) {
      return 'CRITICAL';
    } else if (this.violationCounts.HIGH > 5) {
      return 'WARNING';
    } else if (totalViolations > 20) {
      return 'ATTENTION';
    } else {
      return 'HEALTHY';
    }
  }

  /**
   * Esegue monitoraggio immediato
   */
  async performImmediateMonitoring() {
    try {
      console.log('🔍 Esecuzione monitoraggio immediato...');
      
      await this.performMonitoring();
      
      console.log('✅ Monitoraggio immediato completato');
      
    } catch (error) {
      console.error('❌ Errore nel monitoraggio immediato:', error);
      throw error;
    }
  }

  /**
   * Ottiene lo stato del job
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasMonitoringInterval: this.monitoringInterval !== null,
      hasSummaryInterval: this.summaryInterval !== null,
      violationCounts: this.violationCounts,
      lastSummaryDate: this.lastSummaryDate,
      systemHealth: this.getSystemHealthStatus()
    };
  }

  /**
   * Reset dei contatori violazioni
   */
  resetCounters() {
    this.violationCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0
    };
    console.log('🔄 Contatori violazioni resettati');
  }
}

// Istanza singleton
const violationMonitoringJob = new ViolationMonitoringJob();

module.exports = violationMonitoringJob;
