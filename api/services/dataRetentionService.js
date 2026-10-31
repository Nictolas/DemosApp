/**
 * Servizio per la gestione automatica della data retention
 * Implementa le procedure di cancellazione automatica dei dati scaduti
 */

const { pool } = require('../middleware/auth');
const AuditService = require('./auditService');

class DataRetentionService {
  // RP-10 is unapproved: legacy age-based cleanup must not mutate user records.
  static assertRetentionPolicyApproved() {
    const error = new Error('RETENTION_POLICY_NOT_APPROVED');
    error.code = 'RETENTION_POLICY_NOT_APPROVED';
    error.statusCode = 409;
    throw error;
  }

  /**
   * Policy di retention per ogni tipo di dato (in giorni)
   */
  static getRetentionPolicies() {
    return {
      // Dati utente base
      user_profile: {
        retention_days: 2555, // 7 anni (limite massimo per dati fiscali)
        fields: ['nome', 'cognome', 'email', 'data_nascita', 'cittadinanza'],
        reason: 'Dati fiscali e anagrafici - Art. 2220 c.c.'
      },
      
      // Dati di autenticazione
      auth_data: {
        retention_days: 365, // 1 anno
        fields: ['password_hash', 'last_login', 'login_attempts'],
        reason: 'Sicurezza e prevenzione frodi'
      },
      
      // Dati di sessione
      session_data: {
        retention_days: 30, // 30 giorni
        fields: ['session_token', 'refresh_token', 'session_data'],
        reason: 'Sicurezza e privacy'
      },
      
      // Voti e opinioni
      votes_opinions: {
        retention_days: 1825, // 5 anni
        fields: ['voto', 'opinione', 'grado_elezione', 'paese_elezione'],
        reason: 'Dati politici - Art. 2220 c.c.'
      },
      
      // Log di audit
      audit_logs: {
        retention_days: 2555, // 7 anni
        fields: ['action', 'resource', 'details', 'ip_address'],
        reason: 'Sicurezza e conformità normativa'
      },
      
      // Dati di supporto
      support_data: {
        retention_days: 1095, // 3 anni
        fields: ['ticket_data', 'support_messages', 'resolution_notes'],
        reason: 'Supporto clienti e qualità servizio'
      },
      
      // Dati di analytics
      analytics_data: {
        retention_days: 730, // 2 anni
        fields: ['page_views', 'click_events', 'user_behavior'],
        reason: 'Analytics e miglioramento servizio'
      }
    };
  }

  /**
   * Identifica i dati scaduti per un utente specifico
   */
  static async identifyExpiredData(userId) {
    try {
      const policies = this.getRetentionPolicies();
      const expiredData = [];

      for (const [dataType, policy] of Object.entries(policies)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

        // Query per identificare dati scaduti
        const query = `
          SELECT 
            '${dataType}' as data_type,
            '${policy.retention_days}' as retention_days,
            '${policy.reason}' as reason,
            COUNT(*) as record_count,
            MIN(created_at) as oldest_record,
            MAX(created_at) as newest_record
          FROM users 
          WHERE id = $1 
            AND created_at < $2
        `;

        const result = await pool.query(query, [userId, cutoffDate]);
        
        if (result.rows[0].record_count > 0) {
          expiredData.push({
            ...result.rows[0],
            cutoff_date: cutoffDate,
            policy: policy
          });
        }
      }

      return expiredData;
    } catch (error) {
      console.error('❌ Errore nell\'identificazione dati scaduti:', error);
      throw error;
    }
  }

  /**
   * Cancella dati scaduti per un utente specifico
   */
  static async deleteExpiredData(userId, dataTypes = null) {
    this.assertRetentionPolicyApproved();
    try {
      const policies = this.getRetentionPolicies();
      const deletedCounts = {};
      const errors = [];

      for (const [dataType, policy] of Object.entries(policies)) {
        // Se specificati dataTypes, processa solo quelli
        if (dataTypes && !dataTypes.includes(dataType)) {
          continue;
        }

        try {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

          // Cancella dati scaduti
          const deleteQuery = `
            UPDATE users 
            SET 
              ${policy.fields.map(field => `${field} = NULL`).join(', ')},
              updated_at = NOW()
            WHERE id = $1 
              AND created_at < $2
              AND (${policy.fields.map(field => `${field} IS NOT NULL`).join(' OR ')})
          `;

          const result = await pool.query(deleteQuery, [userId, cutoffDate]);
          deletedCounts[dataType] = result.rowCount;

          // Log dell'operazione
          await AuditService.logAction({
            userId: 'system',
            action: 'DATA_RETENTION_DELETE',
            resource: dataType,
            resourceId: userId,
            details: {
              deleted_count: result.rowCount,
              retention_days: policy.retention_days,
              reason: policy.reason,
              cutoff_date: cutoffDate
            },
            success: true
          });

        } catch (error) {
          console.error(`❌ Errore nella cancellazione ${dataType}:`, error);
          errors.push({ dataType, error: error.message });
        }
      }

      return {
        deletedCounts,
        errors,
        totalDeleted: Object.values(deletedCounts).reduce((sum, count) => sum + count, 0)
      };

    } catch (error) {
      console.error('❌ Errore nella cancellazione dati scaduti:', error);
      throw error;
    }
  }

  /**
   * Cancella dati scaduti per tutti gli utenti
   */
  static async deleteAllExpiredData(dataTypes = null) {
    this.assertRetentionPolicyApproved();
    try {
      const policies = this.getRetentionPolicies();
      const deletedCounts = {};
      const errors = [];

      for (const [dataType, policy] of Object.entries(policies)) {
        if (dataTypes && !dataTypes.includes(dataType)) {
          continue;
        }

        try {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

          // Cancella dati scaduti per tutti gli utenti
          const deleteQuery = `
            UPDATE users 
            SET 
              ${policy.fields.map(field => `${field} = NULL`).join(', ')},
              updated_at = NOW()
            WHERE created_at < $1
              AND (${policy.fields.map(field => `${field} IS NOT NULL`).join(' OR ')})
          `;

          const result = await pool.query(deleteQuery, [cutoffDate]);
          deletedCounts[dataType] = result.rowCount;

          // Log dell'operazione
          await AuditService.logAction({
            userId: 'system',
            action: 'DATA_RETENTION_DELETE_ALL',
            resource: dataType,
            details: {
              deleted_count: result.rowCount,
              retention_days: policy.retention_days,
              reason: policy.reason,
              cutoff_date: cutoffDate
            },
            success: true
          });

        } catch (error) {
          console.error(`❌ Errore nella cancellazione ${dataType}:`, error);
          errors.push({ dataType, error: error.message });
        }
      }

      return {
        deletedCounts,
        errors,
        totalDeleted: Object.values(deletedCounts).reduce((sum, count) => sum + count, 0)
      };

    } catch (error) {
      console.error('❌ Errore nella cancellazione dati scaduti:', error);
      throw error;
    }
  }

  /**
   * Invia notifiche prima della cancellazione
   */
  static async sendRetentionNotifications(daysBeforeDeletion = 30) {
    try {
      const policies = this.getRetentionPolicies();
      const notifications = [];

      for (const [dataType, policy] of Object.entries(policies)) {
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() - (policy.retention_days - daysBeforeDeletion));

        // Trova utenti con dati che scadranno presto
        const query = `
          SELECT id, email, nome, cognome
          FROM users 
          WHERE created_at < $1
            AND (${policy.fields.map(field => `${field} IS NOT NULL`).join(' OR ')})
        `;

        const result = await pool.query(query, [warningDate]);
        
        for (const user of result.rows) {
          notifications.push({
            userId: user.id,
            email: user.email,
            name: `${user.nome} ${user.cognome}`,
            dataType,
            retentionDays: policy.retention_days,
            reason: policy.reason,
            warningDate
          });
        }
      }

      return notifications;
    } catch (error) {
      console.error('❌ Errore nell\'invio notifiche retention:', error);
      throw error;
    }
  }

  /**
   * Ottiene statistiche di data retention
   */
  static async getRetentionStats() {
    try {
      const policies = this.getRetentionPolicies();
      const stats = {};

      // Ottieni le colonne esistenti nella tabella users
      const columnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
      `;
      const columnsResult = await pool.query(columnsQuery);
      const existingColumns = new Set(columnsResult.rows.map(row => row.column_name));

      for (const [dataType, policy] of Object.entries(policies)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

        // Filtra solo i campi che esistono realmente nella tabella
        const existingFields = policy.fields.filter(field => existingColumns.has(field));

        // Se non ci sono campi esistenti per questa policy, salta o usa una query generica
        if (existingFields.length === 0) {
          // Per policy che non hanno campi nella tabella users, usa una query generica
          const query = `
            SELECT 
              COUNT(*) as total_records,
              COUNT(CASE WHEN created_at < $1 THEN 1 END) as expired_records,
              COUNT(CASE WHEN created_at >= $1 THEN 1 END) as active_records
            FROM users
          `;
          const result = await pool.query(query, [cutoffDate]);
          stats[dataType] = {
            ...result.rows[0],
            retention_days: policy.retention_days,
            reason: policy.reason,
            note: 'Policy non applicabile alla tabella users'
          };
        } else {
          const query = `
            SELECT 
              COUNT(*) as total_records,
              COUNT(CASE WHEN created_at < $1 THEN 1 END) as expired_records,
              COUNT(CASE WHEN created_at >= $1 THEN 1 END) as active_records
            FROM users 
            WHERE (${existingFields.map(field => `${field} IS NOT NULL`).join(' OR ')})
          `;

          const result = await pool.query(query, [cutoffDate]);
          stats[dataType] = {
            ...result.rows[0],
            retention_days: policy.retention_days,
            reason: policy.reason
          };
        }
      }

      return stats;
    } catch (error) {
      console.error('❌ Errore nel recupero statistiche retention:', error);
      throw error;
    }
  }

  /**
   * Esegue pulizia completa dei dati scaduti
   */
  static async performFullCleanup() {
    try {
      console.log('🧹 Avvio pulizia completa dati scaduti...');
      
      const result = await this.deleteAllExpiredData();
      
      console.log(`✅ Pulizia completata: ${result.totalDeleted} record cancellati`);
      
      // Log dell'operazione
      await AuditService.logAction({
        userId: 'system',
        action: 'DATA_RETENTION_FULL_CLEANUP',
        resource: 'all',
        details: {
          deleted_counts: result.deletedCounts,
          total_deleted: result.totalDeleted,
          errors: result.errors,
          cleanup_date: new Date()
        },
        success: result.errors.length === 0
      });

      return result;
    } catch (error) {
      console.error('❌ Errore nella pulizia completa:', error);
      throw error;
    }
  }
}

module.exports = DataRetentionService;
