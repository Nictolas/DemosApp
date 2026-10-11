/**
 * Servizio per il backup e recovery del database
 */

const { pool } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

class BackupService {
  /**
   * Configurazione backup
   */
  static getBackupConfig() {
    return {
      // Directory per i backup
      backupDir: process.env.BACKUP_DIR || './backups',
      
      // Frequenza backup
      fullBackupInterval: parseInt(process.env.FULL_BACKUP_INTERVAL_HOURS || '24', 10), // 24 ore
      incrementalBackupInterval: parseInt(process.env.INCREMENTAL_BACKUP_INTERVAL_HOURS || '6', 10), // 6 ore
      
      // Retention policy
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10), // 30 giorni
      maxBackups: parseInt(process.env.MAX_BACKUPS || '10', 10), // 10 backup massimi
      
      // Crittografia
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || null,
      
      // Compressione
      compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
      
      // Notifiche
      notifyOnBackup: process.env.BACKUP_NOTIFICATIONS === 'true',
      notifyOnError: process.env.BACKUP_ERROR_NOTIFICATIONS === 'true'
    };
  }

  /**
   * Genera chiave di crittografia
   */
  static generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Il vecchio backup JSON applicativo non rappresenta piu lo schema completo di DEMOS
   * e non deve essere usato come disaster recovery. Il recovery operativo e affidato
   * a PostgreSQL/provider (pg_dump/pg_restore per i test isolati, PITR Neon in produzione).
   */
  static getLegacyBackupStatus() {
    return {
      enabled: false,
      code: 'LEGACY_APP_BACKUP_RETIRED',
      reason: 'Il backup JSON applicativo legacy e incompleto ed e stato ritirato dalle operazioni di backup/restore.'
    };
  }

  static assertLegacyBackupAvailable() {
    const status = this.getLegacyBackupStatus();
    const error = new Error(status.reason);
    error.code = status.code;
    error.statusCode = 410;
    throw error;
  }

  /**
   * Crea backup completo del database
   */
  static async createFullBackup() {
    this.assertLegacyBackupAvailable();
    try {
      console.log('🔄 Avvio backup completo del database...');
      
      const config = this.getBackupConfig();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `full_backup_${timestamp}.json`;
      const backupPath = path.join(config.backupDir, backupFileName);
      
      // Crea directory se non esiste
      await this.ensureBackupDirectory();
      
      // Esporta tutti i dati
      const backupData = await this.exportAllData();
      
      // Aggiungi metadati
      const backupMetadata = {
        type: 'full',
        timestamp: new Date().toISOString(),
        version: '1.0',
        database: 'supabase_postgresql',
        tables: Object.keys(backupData),
        recordCounts: this.getRecordCounts(backupData),
        checksum: this.calculateChecksum(backupData)
      };
      
      const fullBackup = {
        metadata: backupMetadata,
        data: backupData
      };
      
      // Serializza e critta se necessario
      let backupContent = JSON.stringify(fullBackup, null, 2);
      
      if (config.encryptionKey) {
        backupContent = this.encryptData(backupContent, config.encryptionKey);
      }
      
      // Salva backup
      await writeFile(backupPath, backupContent);
      
      // Verifica integrità
      const isValid = await this.verifyBackupIntegrity(backupPath);
      
      if (!isValid) {
        throw new Error('Backup non valido - verifica integrità fallita');
      }
      
      console.log(`✅ Backup completo creato: ${backupFileName}`);
      
      // Log dell'operazione
      await this.logBackupOperation('full', backupFileName, true, null);
      
      // Pulisci backup vecchi
      await this.cleanupOldBackups();
      
      return {
        success: true,
        fileName: backupFileName,
        path: backupPath,
        size: (await this.getFileSize(backupPath)),
        metadata: backupMetadata
      };
      
    } catch (error) {
      console.error('❌ Errore nel backup completo:', error);
      await this.logBackupOperation('full', null, false, error.message);
      throw error;
    }
  }

  /**
   * Crea backup incrementale
   */
  static async createIncrementalBackup() {
    this.assertLegacyBackupAvailable();
    try {
      console.log('🔄 Avvio backup incrementale del database...');
      
      const config = this.getBackupConfig();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `incremental_backup_${timestamp}.json`;
      const backupPath = path.join(config.backupDir, backupFileName);
      
      // Crea directory se non esiste
      await this.ensureBackupDirectory();
      
      // Trova l'ultimo backup per confronto
      const lastBackup = await this.getLastBackup();
      const lastBackupTime = lastBackup ? new Date(lastBackup.metadata.timestamp) : new Date(0);
      
      // Esporta solo i dati modificati
      const incrementalData = await this.exportIncrementalData(lastBackupTime);
      
      // Aggiungi metadati
      const backupMetadata = {
        type: 'incremental',
        timestamp: new Date().toISOString(),
        version: '1.0',
        database: 'supabase_postgresql',
        baseBackup: lastBackup ? lastBackup.fileName : null,
        tables: Object.keys(incrementalData),
        recordCounts: this.getRecordCounts(incrementalData),
        checksum: this.calculateChecksum(incrementalData)
      };
      
      const incrementalBackup = {
        metadata: backupMetadata,
        data: incrementalData
      };
      
      // Serializza e critta se necessario
      let backupContent = JSON.stringify(incrementalBackup, null, 2);
      
      if (config.encryptionKey) {
        backupContent = this.encryptData(backupContent, config.encryptionKey);
      }
      
      // Salva backup
      await writeFile(backupPath, backupContent);
      
      // Verifica integrità
      const isValid = await this.verifyBackupIntegrity(backupPath);
      
      if (!isValid) {
        throw new Error('Backup incrementale non valido - verifica integrità fallita');
      }
      
      console.log(`✅ Backup incrementale creato: ${backupFileName}`);
      
      // Log dell'operazione
      await this.logBackupOperation('incremental', backupFileName, true, null);
      
      return {
        success: true,
        fileName: backupFileName,
        path: backupPath,
        size: (await this.getFileSize(backupPath)),
        metadata: backupMetadata
      };
      
    } catch (error) {
      console.error('❌ Errore nel backup incrementale:', error);
      await this.logBackupOperation('incremental', null, false, error.message);
      throw error;
    }
  }

  /**
   * Esporta tutti i dati del database
   */
  static async exportAllData() {
    try {
      const tables = [
        'users', 'opinions', 'votes', 'audit_logs', 'user_rights_requests',
        'data_processing_limits', 'data_retention_policies', 'data_retention_logs'
      ];
      
      const backupData = {};
      
      for (const table of tables) {
        try {
          const query = `SELECT * FROM ${table} ORDER BY created_at ASC`;
          const result = await pool.query(query);
          backupData[table] = result.rows;
          console.log(`📊 Esportata tabella ${table}: ${result.rows.length} record`);
        } catch (error) {
          console.warn(`⚠️ Errore nell'esportazione della tabella ${table}:`, error.message);
          backupData[table] = [];
        }
      }
      
      return backupData;
    } catch (error) {
      console.error('❌ Errore nell\'esportazione dati:', error);
      throw error;
    }
  }

  /**
   * Esporta solo i dati modificati dall'ultimo backup
   */
  static async exportIncrementalData(since) {
    try {
      const tables = [
        'users', 'opinions', 'votes', 'audit_logs', 'user_rights_requests',
        'data_processing_limits', 'data_retention_policies', 'data_retention_logs'
      ];
      
      const incrementalData = {};
      
      for (const table of tables) {
        try {
          // Usa updated_at se disponibile, altrimenti created_at
          const timeColumn = this.getTimeColumn(table);
          const query = `SELECT * FROM ${table} WHERE ${timeColumn} > $1 ORDER BY ${timeColumn} ASC`;
          const result = await pool.query(query, [since]);
          incrementalData[table] = result.rows;
          console.log(`📊 Esportata tabella ${table}: ${result.rows.length} record modificati`);
        } catch (error) {
          console.warn(`⚠️ Errore nell'esportazione incrementale della tabella ${table}:`, error.message);
          incrementalData[table] = [];
        }
      }
      
      return incrementalData;
    } catch (error) {
      console.error('❌ Errore nell\'esportazione incrementale:', error);
      throw error;
    }
  }

  /**
   * Determina la colonna temporale per una tabella
   */
  static getTimeColumn(table) {
    const timeColumns = {
      'users': 'updated_at',
      'opinions': 'updated_at',
      'votes': 'created_at',
      'audit_logs': 'timestamp',
      'user_rights_requests': 'updated_at',
      'data_processing_limits': 'updated_at',
      'data_retention_policies': 'updated_at',
      'data_retention_logs': 'created_at'
    };
    
    return timeColumns[table] || 'created_at';
  }

  /**
   * Calcola checksum dei dati
   */
  static calculateChecksum(data) {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Ottiene conteggi record per tabella
   */
  static getRecordCounts(data) {
    const counts = {};
    for (const [table, records] of Object.entries(data)) {
      counts[table] = records.length;
    }
    return counts;
  }

  /**
   * Cripta i dati
   */
  static encryptData(data, key) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decripta i dati
   */
  static decryptData(encryptedData, key) {
    const algorithm = 'aes-256-gcm';
    const data = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Verifica integrità del backup
   */
  static async verifyBackupIntegrity(backupPath) {
    try {
      const backupContent = await readFile(backupPath, 'utf8');
      const config = this.getBackupConfig();
      
      let backupData;
      if (config.encryptionKey) {
        const decryptedContent = this.decryptData(backupContent, config.encryptionKey);
        backupData = JSON.parse(decryptedContent);
      } else {
        backupData = JSON.parse(backupContent);
      }
      
      // Verifica struttura
      if (!backupData.metadata || !backupData.data) {
        return false;
      }
      
      // Verifica checksum
      const calculatedChecksum = this.calculateChecksum(backupData.data);
      if (calculatedChecksum !== backupData.metadata.checksum) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Errore nella verifica integrità backup:', error);
      return false;
    }
  }

  /**
   * Ripristina database da backup
   */
  static async restoreFromBackup(backupFileName) {
    this.assertLegacyBackupAvailable();
    try {
      console.log(`🔄 Avvio ripristino da backup: ${backupFileName}`);
      
      const config = this.getBackupConfig();
      const backupPath = path.join(config.backupDir, backupFileName);
      
      // Verifica che il file esista
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup non trovato: ${backupFileName}`);
      }
      
      // Leggi e decripta backup
      const backupContent = await readFile(backupPath, 'utf8');
      let backupData;
      
      if (config.encryptionKey) {
        const decryptedContent = this.decryptData(backupContent, config.encryptionKey);
        backupData = JSON.parse(decryptedContent);
      } else {
        backupData = JSON.parse(backupContent);
      }
      
      // Verifica integrità
      const isValid = await this.verifyBackupIntegrity(backupPath);
      if (!isValid) {
        throw new Error('Backup corrotto - impossibile ripristinare');
      }
      
      // Inizia transazione
      const client = await pool.connect();
      await client.query('BEGIN');
      
      try {
        // Pulisci tabelle esistenti (ATTENZIONE: questo cancella tutti i dati!)
        const tables = Object.keys(backupData.data);
        for (const table of tables) {
          await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        }
        
        // Ripristina dati
        for (const [table, records] of Object.entries(backupData.data)) {
          if (records.length > 0) {
            await this.insertRecords(client, table, records);
            console.log(`📊 Ripristinata tabella ${table}: ${records.length} record`);
          }
        }
        
        await client.query('COMMIT');
        console.log(`✅ Ripristino completato: ${backupFileName}`);
        
        // Log dell'operazione
        await this.logBackupOperation('restore', backupFileName, true, null);
        
        return {
          success: true,
          fileName: backupFileName,
          tablesRestored: tables.length,
          totalRecords: Object.values(backupData.data).reduce((sum, records) => sum + records.length, 0)
        };
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Errore nel ripristino:', error);
      await this.logBackupOperation('restore', backupFileName, false, error.message);
      throw error;
    }
  }

  /**
   * Inserisce record in una tabella
   */
  static async insertRecords(client, table, records) {
    if (records.length === 0) return;
    
    const columns = Object.keys(records[0]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    for (const record of records) {
      const values = columns.map(col => record[col]);
      await client.query(query, values);
    }
  }

  /**
   * Ottiene lista dei backup disponibili
   */
  static async getBackupList() {
    try {
      const config = this.getBackupConfig();
      await this.ensureBackupDirectory();
      
      const files = await readdir(config.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.json'));
      
      const backups = [];
      
      for (const file of backupFiles) {
        try {
          const filePath = path.join(config.backupDir, file);
          const stats = fs.statSync(filePath);
          const size = stats.size;
          
          // Leggi metadati
          const backupContent = await readFile(filePath, 'utf8');
          let metadata;
          
          if (config.encryptionKey) {
            const decryptedContent = this.decryptData(backupContent, config.encryptionKey);
            const backupData = JSON.parse(decryptedContent);
            metadata = backupData.metadata;
          } else {
            const backupData = JSON.parse(backupContent);
            metadata = backupData.metadata;
          }
          
          backups.push({
            fileName: file,
            type: metadata.type,
            timestamp: metadata.timestamp,
            size: size,
            recordCounts: metadata.recordCounts,
            checksum: metadata.checksum
          });
        } catch (error) {
          console.warn(`⚠️ Errore nella lettura backup ${file}:`, error.message);
        }
      }
      
      // Ordina per timestamp (più recenti prima)
      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
    } catch (error) {
      console.error('❌ Errore nel recupero lista backup:', error);
      throw error;
    }
  }

  /**
   * Pulisce backup vecchi
   */
  static async cleanupOldBackups() {
    try {
      const config = this.getBackupConfig();
      const backups = await this.getBackupList();
      
      // Rimuovi backup più vecchi della retention policy
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
      
      let removedCount = 0;
      
      for (const backup of backups) {
        const backupDate = new Date(backup.timestamp);
        
        if (backupDate < cutoffDate) {
          const filePath = path.join(config.backupDir, backup.fileName);
          await unlink(filePath);
          console.log(`🗑️ Rimosso backup vecchio: ${backup.fileName}`);
          removedCount++;
        }
      }
      
      // Mantieni solo il numero massimo di backup
      const remainingBackups = backups.filter(backup => {
        const backupDate = new Date(backup.timestamp);
        return backupDate >= cutoffDate;
      });
      
      if (remainingBackups.length > config.maxBackups) {
        const toRemove = remainingBackups.slice(config.maxBackups);
        
        for (const backup of toRemove) {
          const filePath = path.join(config.backupDir, backup.fileName);
          await unlink(filePath);
          console.log(`🗑️ Rimosso backup in eccesso: ${backup.fileName}`);
          removedCount++;
        }
      }
      
      console.log(`✅ Pulizia backup completata: ${removedCount} file rimossi`);
      
    } catch (error) {
      console.error('❌ Errore nella pulizia backup:', error);
    }
  }

  /**
   * Ottiene l'ultimo backup
   */
  static async getLastBackup() {
    try {
      const backups = await this.getBackupList();
      return backups.length > 0 ? backups[0] : null;
    } catch (error) {
      console.error('❌ Errore nel recupero ultimo backup:', error);
      return null;
    }
  }

  /**
   * Crea directory backup se non esiste
   */
  static async ensureBackupDirectory() {
    const config = this.getBackupConfig();
    
    if (!fs.existsSync(config.backupDir)) {
      await mkdir(config.backupDir, { recursive: true });
      console.log(`📁 Creata directory backup: ${config.backupDir}`);
    }
  }

  /**
   * Ottiene dimensione file
   */
  static async getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Log operazioni backup
   */
  static async logBackupOperation(type, fileName, success, error) {
    try {
      // Usa AuditService che gestisce automaticamente Axiom
      const AuditService = require('./auditService');
      await AuditService.logAction({
        userId: 'system',
        action: 'BACKUP_OPERATION',
        resource: 'backup',
        resourceId: fileName,
        details: {
          backup_type: type,
          file_name: fileName,
          timestamp: new Date().toISOString()
        },
        success: success,
        errorMessage: error || null,
        ipAddress: 'system'
      });
    } catch (logError) {
      console.error('❌ Errore nel log backup:', logError);
    }
  }

  /**
   * Ottiene statistiche backup
   */
  static async getBackupStats() {
    try {
      const backups = await this.getBackupList();
      const config = this.getBackupConfig();
      
      const stats = {
        totalBackups: backups.length,
        fullBackups: backups.filter(b => b.type === 'full').length,
        incrementalBackups: backups.filter(b => b.type === 'incremental').length,
        totalSize: backups.reduce((sum, b) => sum + b.size, 0),
        lastBackup: backups.length > 0 ? backups[0].timestamp : null,
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
        config: {
          retentionDays: config.retentionDays,
          maxBackups: config.maxBackups,
          encryptionEnabled: !!config.encryptionKey,
          compressionEnabled: config.compressionEnabled
        }
      };
      
      return stats;
    } catch (error) {
      console.error('❌ Errore nel recupero statistiche backup:', error);
      throw error;
    }
  }
}

module.exports = BackupService;
