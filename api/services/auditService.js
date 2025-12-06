const { pool } = require('../middleware/auth');

// Axiom integration per audit logs
let Axiom;
let axiomAudit;
try {
  Axiom = require('@axiomhq/axiom-node');
  if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
    axiomAudit = new Axiom({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: process.env.AXIOM_REGION || 'eu'
    });
  }
} catch (error) {
  // Axiom SDK non installato, continua senza
  axiomAudit = null;
}

class AuditService {
  /**
   * Registra un'azione nell'audit log
   * @param {Object} params - Parametri dell'azione
   * @param {string} params.userId - ID utente
   * @param {string} params.action - Tipo di azione (DATA_ACCESS, DATA_MODIFY, DATA_DELETE, CONSENT_CHANGE, etc.)
   * @param {string} params.resource - Risorsa interessata (users, votes, opinions, etc.)
   * @param {string} params.resourceId - ID specifico della risorsa
   * @param {Object} params.details - Dettagli aggiuntivi
   * @param {string} params.ipAddress - Indirizzo IP
   * @param {string} params.userAgent - User Agent
   * @param {boolean} params.success - Se l'azione è riuscita
   * @param {string} params.errorMessage - Messaggio di errore se presente
   */
  static async logAction({
    userId,
    action,
    resource,
    resourceId = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    success = true,
    errorMessage = null
  }) {
    try {
      const query = `
        INSERT INTO audit_logs_compressed (
          id, user_id, action, resource, resource_id, details, 
          ip_address, user_agent, timestamp, success, error_message, created_at
        ) VALUES (gen_random_uuid(), $1, compress_audit_action($2), compress_audit_resource($3), $4, $5, compress_ip_address($6), compress_audit_user_agent($7), $8, $9, $10, $11)
        RETURNING id
      `;
      
      const now = Date.now(); // Timestamp in millisecondi
      
      const values = [
        userId,
        action, // Sarà compresso dalla funzione compress_audit_action
        resource, // Sarà compresso dalla funzione compress_audit_resource
        resourceId,
        JSON.stringify(details),
        ipAddress, // Sarà compresso dalla funzione compress_ip_address
        userAgent, // Sarà compresso dalla funzione compress_audit_user_agent
        now, // timestamp
        success,
        errorMessage,
        now // created_at
      ];

      const result = await pool.query(query, values);
      
      console.log(`📝 Audit log creato: ${action} su ${resource} per utente ${userId}`);
      
      // Invia anche ad Axiom (non blocca se fallisce)
      const auditLog = {
        user_id: userId,
        action: action,
        resource: resource,
        resource_id: resourceId,
        details: details,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: success,
        error_message: errorMessage,
        timestamp: new Date(now)
      };
      
      this.sendAuditLogToAxiom(auditLog).catch(() => {});
      
      return { id: result.rows[0].id, timestamp: new Date(now) };
    } catch (error) {
      console.error('❌ Errore nel logging audit:', error);
      // Non lanciare errore per non bloccare l'operazione principale
      return null;
    }
  }

  /**
   * Invia audit log ad Axiom
   * @private
   */
  static async sendAuditLogToAxiom(auditLog) {
    if (!axiomAudit || process.env.AXIOM_ENABLED !== 'true') return;

    try {
      const logEntry = {
        _time: new Date(auditLog.timestamp || Date.now()).toISOString(),
        log_type: 'audit', // Tag per distinguere nel dataset real-time
        type: 'audit',
        user_id: auditLog.user_id,
        action: auditLog.action,
        resource: auditLog.resource,
        resource_id: auditLog.resource_id,
        success: auditLog.success,
        ip_address: auditLog.ip_address,
        user_agent: auditLog.user_agent,
        error_message: auditLog.error_message
      };

      // Aggiungi details se presente
      if (auditLog.details) {
        if (typeof auditLog.details === 'string') {
          try {
            Object.assign(logEntry, JSON.parse(auditLog.details));
          } catch (e) {
            logEntry.details = auditLog.details;
          }
        } else {
          Object.assign(logEntry, auditLog.details);
        }
      }

      // Anonimizza se richiesto (GDPR)
      if (process.env.AXIOM_ANONYMIZE === 'true') {
        // Anonimizza IP (solo rete)
        if (logEntry.ip_address) {
          const parts = logEntry.ip_address.split('.');
          if (parts.length === 4) {
            logEntry.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
          }
        }
        
        // Hash user_id se richiesto
        if (logEntry.user_id && process.env.AXIOM_ANONYMIZE_USER_ID === 'true') {
          const crypto = require('crypto');
          logEntry.user_id = crypto
            .createHash('sha256')
            .update(logEntry.user_id + (process.env.EXPORT_HASH_SALT || 'axiom-salt'))
            .digest('hex')
            .substring(0, 16);
        }
      }

      // Invia ad Axiom (non blocca se fallisce)
      // Audit logs vanno nel dataset real-time insieme a performance e security
      const dataset = process.env.AXIOM_REALTIME_DATASET || process.env.AXIOM_AUDIT_DATASET || 'real-time';
      axiomAudit.datasets.ingest(dataset, [logEntry])
        .catch(err => {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Errore invio audit log Axiom:', err.message);
          }
        });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Errore preparazione audit log Axiom:', error);
      }
    }
  }

  /**
   * Ottiene i log di audit per un utente
   * @param {string} userId - ID utente
   * @param {Object} filters - Filtri opzionali
   * @param {string} filters.action - Filtra per tipo di azione
   * @param {string} filters.resource - Filtra per risorsa
   * @param {Date} filters.fromDate - Data inizio
   * @param {Date} filters.toDate - Data fine
   * @param {number} filters.limit - Limite risultati
   * @param {number} filters.offset - Offset per paginazione
   */
  static async getUserAuditLogs(userId, filters = {}) {
    try {
      let query = `
        SELECT id, action, resource, resource_id, details, 
               ip_address, user_agent, timestamp, success, error_message
        FROM audit_logs_decompressed 
        WHERE user_id = $1
      `;
      
      const values = [userId];
      let paramCount = 1;

      // Aggiungi filtri
      if (filters.action) {
        paramCount++;
        query += ` AND action = $${paramCount}`;
        values.push(filters.action);
      }

      if (filters.resource) {
        paramCount++;
        query += ` AND resource = $${paramCount}`;
        values.push(filters.resource);
      }

      if (filters.fromDate) {
        paramCount++;
        query += ` AND timestamp >= $${paramCount}`;
        values.push(filters.fromDate);
      }

      if (filters.toDate) {
        paramCount++;
        query += ` AND timestamp <= $${paramCount}`;
        values.push(filters.toDate);
      }

      query += ` ORDER BY timestamp DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore nel recupero audit logs:', error);
      throw error;
    }
  }

  /**
   * Ottiene statistiche di audit per un utente
   * @param {string} userId - ID utente
   */
  static async getUserAuditStats(userId) {
    try {
      const query = `
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(CASE WHEN success = true THEN 1 END) as success_count,
          COUNT(CASE WHEN success = false THEN 1 END) as error_count,
          MIN(timestamp) as first_action,
          MAX(timestamp) as last_action
        FROM audit_logs_decompressed 
        WHERE user_id = $1
        GROUP BY action
        ORDER BY count DESC
      `;
      
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore nel recupero statistiche audit:', error);
      throw error;
    }
  }

  /**
   * Pulisce i log di audit più vecchi di X giorni
   * @param {number} daysToKeep - Giorni da mantenere
   */
  static async cleanupOldLogs(daysToKeep = 365) {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000); // Converti in millisecondi
      const query = `
        DELETE FROM audit_logs_compressed 
        WHERE timestamp < $1
      `;
      
      const result = await pool.query(query, [cutoffTime]);
      console.log(`🧹 Puliti ${result.rowCount} log di audit più vecchi di ${daysToKeep} giorni`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Errore nella pulizia audit logs:', error);
      throw error;
    }
  }

  /**
   * Verifica se un utente ha limitazioni di trattamento
   * @param {string} userId - ID utente
   */
  static async hasProcessingLimits(userId) {
    try {
      const query = `
        SELECT processing_limited, limited_categories, reason
        FROM data_processing_limits 
        WHERE user_id = $1
      `;
      
      const result = await pool.query(query, [userId]);
      return result.rows[0] || { processing_limited: false, limited_categories: [], reason: null };
    } catch (error) {
      console.error('❌ Errore nel controllo limitazioni trattamento:', error);
      return { processing_limited: false, limited_categories: [], reason: null };
    }
  }

  /**
   * Imposta limitazioni di trattamento per un utente
   * @param {string} userId - ID utente
   * @param {boolean} limited - Se limitare il trattamento
   * @param {Array} categories - Categorie da limitare
   * @param {string} reason - Motivo della limitazione
   */
  static async setProcessingLimits(userId, limited, categories = [], reason = null) {
    try {
      const query = `
        INSERT INTO data_processing_limits (user_id, processing_limited, limited_categories, reason)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          processing_limited = EXCLUDED.processing_limited,
          limited_categories = EXCLUDED.limited_categories,
          reason = EXCLUDED.reason,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await pool.query(query, [userId, limited, categories, reason]);
      
      // Log dell'azione
      await this.logAction({
        userId,
        action: limited ? 'PROCESSING_LIMITED' : 'PROCESSING_UNLIMITED',
        resource: 'data_processing_limits',
        resourceId: result.rows[0].id,
        details: { limited, categories, reason },
        success: true
      });
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Errore nell\'impostazione limitazioni trattamento:', error);
      throw error;
    }
  }

  /**
   * Rileva attività sospette
   */
  static async detectSuspiciousActivity(days = 7) {
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000); // Converti in millisecondi
      const query = `
        SELECT 
          user_id,
          ip_address,
          COUNT(*) as action_count,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_count
        FROM audit_logs_decompressed 
        WHERE timestamp >= $1
        GROUP BY user_id, ip_address
        HAVING COUNT(*) > 50 OR COUNT(CASE WHEN success = false THEN 1 END) > 10
        ORDER BY action_count DESC
      `;
      
      const result = await pool.query(query, [new Date(cutoffTime)]);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore nel rilevamento attività sospette:', error);
      throw error;
    }
  }

  /**
   * Ottiene statistiche generali
   */
  static async getAuditStats(days = 30) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_actions,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_actions,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT action) as unique_actions
        FROM audit_logs_decompressed 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
      `;
      
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Errore nel recupero statistiche:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
