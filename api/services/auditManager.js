/**
 * Gestore semplificato per il sistema di audit logging
 * Funziona senza dipendenze esterne
 */

const AuditService = require('./auditService');
const auditConfig = require('../config/audit-config');

class AuditManager {
  constructor() {
    this.isEnabled = true;
    this.cleanupInterval = null;
    this.statsInterval = null;
  }

  /**
   * Avvia il sistema di audit (senza job automatici)
   */
  start() {
    if (!this.isEnabled) {
      console.log('⚠️ Sistema di audit disabilitato');
      return;
    }

    console.log('🔍 Sistema di audit logging avviato');
    
    // Avvia pulizia manuale ogni 24 ore (se abilitato)
    if (auditConfig.enableScheduledJobs) {
      this.startManualCleanup();
    }
  }

  /**
   * Ferma il sistema di audit
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    console.log('🛑 Sistema di audit logging fermato');
  }

  /**
   * Avvia pulizia manuale dei log vecchi
   */
  startManualCleanup() {
    // Esegui pulizia ogni 24 ore
    this.cleanupInterval = setInterval(async () => {
      try {
        console.log('🧹 Avvio pulizia manuale log di audit...');
        const deletedCount = await AuditService.cleanupOldLogs(auditConfig.logRetentionDays);
        console.log(`✅ Pulizia completata: rimossi ${deletedCount} log di audit`);
      } catch (error) {
        console.error('❌ Errore nella pulizia manuale:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 ore
  }

  /**
   * Esegue pulizia manuale immediata
   */
  async cleanupNow() {
    try {
      console.log('🧹 Esecuzione pulizia immediata...');
      const deletedCount = await AuditService.cleanupOldLogs(auditConfig.logRetentionDays);
      console.log(`✅ Pulizia immediata completata: rimossi ${deletedCount} log di audit`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Errore nella pulizia immediata:', error);
      throw error;
    }
  }

  /**
   * Rileva attività sospette manualmente
   */
  async detectSuspiciousActivity(days = 7) {
    try {
      console.log(`🔍 Rilevamento attività sospette negli ultimi ${days} giorni...`);
      
      const suspicious = await AuditService.detectSuspiciousActivity(days);
      
      if (suspicious.length > 0) {
        console.log(`⚠️ Trovate ${suspicious.length} attività sospette`);
        return suspicious;
      } else {
        console.log('✅ Nessuna attività sospetta rilevata');
        return [];
      }
    } catch (error) {
      console.error('❌ Errore nel rilevamento attività sospette:', error);
      throw error;
    }
  }

  /**
   * Genera statistiche manuali
   */
  async generateStats(days = 30) {
    try {
      console.log(`📊 Generazione statistiche per gli ultimi ${days} giorni...`);
      
      const stats = await AuditService.getAuditStats(days);
      console.log('✅ Statistiche generate:', stats);
      
      return stats;
    } catch (error) {
      console.error('❌ Errore nella generazione statistiche:', error);
      throw error;
    }
  }

  /**
   * Abilita/disabilita il sistema
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`🔧 Sistema di audit ${enabled ? 'abilitato' : 'disabilitato'}`);
  }

  /**
   * Ottiene lo stato del sistema
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      cleanupRunning: this.cleanupInterval !== null,
      statsRunning: this.statsInterval !== null,
      config: auditConfig
    };
  }
}

// Istanza singleton
const auditManager = new AuditManager();

module.exports = auditManager;
