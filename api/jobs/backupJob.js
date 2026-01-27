/**
 * Job automatico per backup del database
 */

const BackupService = require('../services/backupService');
const NotificationService = require('../services/notificationService');

class BackupJob {
  constructor() {
    this.isRunning = false;
    this.fullBackupInterval = null;
    this.incrementalBackupInterval = null;
    this.lastFullBackup = null;
    this.lastIncrementalBackup = null;
  }

  /**
   * Avvia il job di backup
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Job di backup già in esecuzione');
      return;
    }

    console.log('🚀 Avvio job di backup automatico...');
    this.isRunning = true;

    const config = BackupService.getBackupConfig();

    // Backup completo ogni 24 ore (o come configurato)
    this.fullBackupInterval = setInterval(() => {
      // Wrappare in Promise per gestire errori async e evitare unhandledRejection
      Promise.resolve(this.performFullBackup()).catch(error => {
        console.error('❌ Errore non gestito in performFullBackup():', error);
      });
    }, config.fullBackupInterval * 60 * 60 * 1000); // Converti ore in millisecondi

    // Backup incrementale ogni 6 ore (o come configurato)
    this.incrementalBackupInterval = setInterval(() => {
      // Wrappare in Promise per gestire errori async e evitare unhandledRejection
      Promise.resolve(this.performIncrementalBackup()).catch(error => {
        console.error('❌ Errore non gestito in performIncrementalBackup():', error);
      });
    }, config.incrementalBackupInterval * 60 * 60 * 1000); // Converti ore in millisecondi

    // Esegui backup completo immediato all'avvio
    setTimeout(() => {
      // Wrappare in Promise per gestire errori async
      Promise.resolve(this.performFullBackup()).catch(error => {
        console.error('❌ Errore non gestito in performFullBackup() (startup):', error);
      });
    }, 5000); // 5 secondi dopo l'avvio

    console.log('✅ Job di backup automatico avviato');
  }

  /**
   * Ferma il job di backup
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Job di backup non in esecuzione');
      return;
    }

    if (this.fullBackupInterval) {
      clearInterval(this.fullBackupInterval);
      this.fullBackupInterval = null;
    }

    if (this.incrementalBackupInterval) {
      clearInterval(this.incrementalBackupInterval);
      this.incrementalBackupInterval = null;
    }

    this.isRunning = false;
    console.log('🛑 Job di backup automatico fermato');
  }

  /**
   * Esegue backup completo
   */
  async performFullBackup() {
    try {
      console.log('🔄 Esecuzione backup completo...');
      
      const result = await BackupService.createFullBackup();
      
      if (result.success) {
        this.lastFullBackup = new Date();
        console.log(`✅ Backup completo completato: ${result.fileName}`);
        
        // Invia notifica se abilitata
        if (BackupService.getBackupConfig().notifyOnBackup) {
          await this.sendBackupNotification('full', result, null);
        }
      }
      
    } catch (error) {
      console.error('❌ Errore nel backup completo:', error);
      
      // Invia notifica di errore se abilitata
      if (BackupService.getBackupConfig().notifyOnError) {
        await this.sendBackupErrorNotification('full', error);
      }
    }
  }

  /**
   * Esegue backup incrementale
   */
  async performIncrementalBackup() {
    try {
      console.log('🔄 Esecuzione backup incrementale...');
      
      const result = await BackupService.createIncrementalBackup();
      
      if (result.success) {
        this.lastIncrementalBackup = new Date();
        console.log(`✅ Backup incrementale completato: ${result.fileName}`);
        
        // Invia notifica se abilitata
        if (BackupService.getBackupConfig().notifyOnBackup) {
          await this.sendBackupNotification('incremental', result, null);
        }
      }
      
    } catch (error) {
      console.error('❌ Errore nel backup incrementale:', error);
      
      // Invia notifica di errore se abilitata
      if (BackupService.getBackupConfig().notifyOnError) {
        await this.sendBackupErrorNotification('incremental', error);
      }
    }
  }

  /**
   * Esegue backup immediato
   */
  async performImmediateBackup(type = 'full') {
    try {
      console.log(`🔄 Esecuzione backup immediato (${type})...`);
      
      let result;
      if (type === 'full') {
        result = await BackupService.createFullBackup();
        this.lastFullBackup = new Date();
      } else {
        result = await BackupService.createIncrementalBackup();
        this.lastIncrementalBackup = new Date();
      }
      
      if (result.success) {
        console.log(`✅ Backup immediato completato: ${result.fileName}`);
        
        // Invia notifica
        await this.sendBackupNotification(type, result, 'immediate');
        
        return result;
      }
      
    } catch (error) {
      console.error('❌ Errore nel backup immediato:', error);
      
      // Invia notifica di errore
      await this.sendBackupErrorNotification(type, error);
      
      throw error;
    }
  }

  /**
   * Invia notifica di backup completato
   */
  async sendBackupNotification(type, result, trigger) {
    try {
      const config = BackupService.getBackupConfig();
      
      const notificationData = {
        type: 'BACKUP_COMPLETED',
        backupType: type,
        fileName: result.fileName,
        size: result.size,
        recordCounts: result.metadata.recordCounts,
        trigger: trigger || 'scheduled',
        timestamp: new Date().toISOString()
      };
      
      await NotificationService.sendSystemAlertNotification(notificationData);
      
    } catch (error) {
      console.error('❌ Errore nell\'invio notifica backup:', error);
    }
  }

  /**
   * Invia notifica di errore backup
   */
  async sendBackupErrorNotification(type, error) {
    try {
      const config = BackupService.getBackupConfig();
      
      const notificationData = {
        type: 'BACKUP_ERROR',
        backupType: type,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      await NotificationService.sendSystemAlertNotification(notificationData);
      
    } catch (notificationError) {
      console.error('❌ Errore nell\'invio notifica errore backup:', notificationError);
    }
  }

  /**
   * Ottiene stato del job
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasFullBackupInterval: this.fullBackupInterval !== null,
      hasIncrementalBackupInterval: this.incrementalBackupInterval !== null,
      lastFullBackup: this.lastFullBackup,
      lastIncrementalBackup: this.lastIncrementalBackup,
      config: BackupService.getBackupConfig()
    };
  }

  /**
   * Esegue test di integrità backup
   */
  async performIntegrityTest() {
    try {
      console.log('🔍 Esecuzione test di integrità backup...');
      
      const backups = await BackupService.getBackupList();
      const testResults = [];
      
      for (const backup of backups.slice(0, 5)) { // Testa solo gli ultimi 5 backup
        try {
          const isValid = await BackupService.verifyBackupIntegrity(
            require('path').join(BackupService.getBackupConfig().backupDir, backup.fileName)
          );
          
          testResults.push({
            fileName: backup.fileName,
            type: backup.type,
            timestamp: backup.timestamp,
            isValid: isValid,
            error: null
          });
          
          console.log(`${isValid ? '✅' : '❌'} Backup ${backup.fileName}: ${isValid ? 'Valido' : 'Non valido'}`);
          
        } catch (error) {
          testResults.push({
            fileName: backup.fileName,
            type: backup.type,
            timestamp: backup.timestamp,
            isValid: false,
            error: error.message
          });
          
          console.log(`❌ Backup ${backup.fileName}: Errore - ${error.message}`);
        }
      }
      
      const validCount = testResults.filter(r => r.isValid).length;
      const totalCount = testResults.length;
      
      console.log(`📊 Test integrità completato: ${validCount}/${totalCount} backup validi`);
      
      return {
        success: true,
        totalTested: totalCount,
        validBackups: validCount,
        invalidBackups: totalCount - validCount,
        results: testResults
      };
      
    } catch (error) {
      console.error('❌ Errore nel test di integrità:', error);
      throw error;
    }
  }

  /**
   * Pulisce backup vecchi
   */
  async cleanupOldBackups() {
    try {
      console.log('🧹 Esecuzione pulizia backup vecchi...');
      await BackupService.cleanupOldBackups();
      console.log('✅ Pulizia backup completata');
    } catch (error) {
      console.error('❌ Errore nella pulizia backup:', error);
      throw error;
    }
  }
}

// Istanza singleton
const backupJob = new BackupJob();

module.exports = backupJob;
