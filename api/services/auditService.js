const { pool } = require('../middleware/auth');
const { createFailureReporter } = require('../utils/logDeliveryFailureReporter');
const { buildAxiomAuditEvent } = require('../utils/axiomAuditEvent');
const reportAuditDeliveryFailure = createFailureReporter();

// Axiom integration per audit logs
let Axiom;
let axiomAudit;
try {
  const axiomModule = require('@axiomhq/axiom-node');
  if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
    // Usa Client se disponibile, altrimenti usa direttamente il modulo
    if (axiomModule.Client) {
      axiomAudit = new axiomModule.Client({
        token: process.env.AXIOM_API_TOKEN,
        orgId: process.env.AXIOM_ORG_ID,
        region: process.env.AXIOM_REGION || 'eu'
      });
    } else {
      // Fallback: usa direttamente il modulo (metodo deprecato)
      axiomAudit = axiomModule;
      axiomAudit.token = process.env.AXIOM_API_TOKEN;
      axiomAudit.orgId = process.env.AXIOM_ORG_ID;
      axiomAudit.region = process.env.AXIOM_REGION || 'eu';
    }
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
      const now = Date.now(); // Timestamp in millisecondi
      
      // Prepara audit log per Axiom
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
      
      // DISABILITATO: I log vengono salvati solo su Axiom, non più su PostgreSQL
      // Questo per alleggerire il database e centralizzare i log su Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        // L'esito HTTP deve essere noto prima di dichiarare il log registrato.
        // Non blocca permanentemente: timeout di rete limitato a 5 secondi.
        const dataset = process.env.AXIOM_REALTIME_DATASET || process.env.AXIOM_AUDIT_DATASET || 'real-time';
        const delivered = await AuditService.sendAuditLogToAxiomHTTP(dataset, auditLog);
        if (!delivered) return null;
        return { id: 'axiom-' + Date.now(), timestamp: new Date(now) };
      }
      
      // Solo se Axiom non è abilitato, salva su PostgreSQL (fallback)
      const query = `
        INSERT INTO audit_logs_compressed (
          id, user_id, action, resource, resource_id, details, 
          ip_address, user_agent, timestamp, success, error_message, created_at
        ) VALUES (gen_random_uuid(), $1, compress_audit_action($2), compress_audit_resource($3), $4, $5, compress_ip_address($6), compress_audit_user_agent($7), $8, $9, $10, $11)
        RETURNING id
      `;
      
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
      
      console.log('AUDIT_DB_WRITE_SUCCESS');
      
      return { id: result.rows[0].id, timestamp: new Date(now) };
    } catch (error) {
      reportAuditDeliveryFailure(error?.response?.status);
      // Non lanciare errore per non bloccare l'operazione principale
      return null;
    }
  }

  /**
   * Invia audit log ad Axiom usando HTTP diretto
   * @private
   */
  static async sendAuditLogToAxiomHTTP(dataset, auditLog) {
    if (process.env.AXIOM_ENABLED !== 'true') return false;
    if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
      reportAuditDeliveryFailure(null);
      return false;
    }
    
    try {
      // Campi minimizzati e categoria esplicita per lifecycle separati.
      const auditLogs = Array.isArray(auditLog) ? auditLog : [auditLog];
      const logEntries = auditLogs.map(audit => buildAxiomAuditEvent(audit));
      
      // NOTA: Campi rimossi (non obbligatori per GDPR):
      // - log_type: categorizzazione non obbligatoria
      // - type: duplicato di log_type
      // - user_agent: non obbligatorio per GDPR
      // - details.*: campi nested non necessari (es. method, path, endpoint già coperti da action/resource)

      // Anonimizza se richiesto (GDPR)
      if (process.env.AXIOM_ANONYMIZE === 'true') {
        const crypto = require('crypto');
        logEntries.forEach(logEntry => {
          // Anonimizza IP (solo rete)
          if (logEntry.ip_address) {
            const parts = logEntry.ip_address.split('.');
            if (parts.length === 4) {
              logEntry.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
            }
          }
          
          // Hash user_id se richiesto
          if (logEntry.user_id && process.env.AXIOM_ANONYMIZE_USER_ID === 'true') {
            logEntry.user_id = crypto
              .createHash('sha256')
              .update(logEntry.user_id + (process.env.EXPORT_HASH_SALT || 'axiom-salt'))
              .digest('hex')
              .substring(0, 16);
          }
        });
      }
    
      const axios = require('axios');
      
      const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
      const edgeDomain = process.env.AXIOM_EDGE_DOMAIN 
        || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
      const url = `https://${edgeDomain}/v1/ingest/${dataset}`;
      
      const token = process.env.AXIOM_API_TOKEN;
      const orgId = process.env.AXIOM_ORG_ID;
      
      await axios.post(url, logEntries, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': orgId
        },
        timeout: 5000, // Timeout breve per non bloccare
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      return true;
    } catch (error) {
      // Non loggare body, URL, token, indirizzi IP, identificativi o error.message.
      reportAuditDeliveryFailure(error?.response?.status);
      return false;
    }
  }

  /**
   * Invia audit log ad Axiom (metodo legacy - mantiene compatibilità)
   * @private
   */
  static async sendAuditLogToAxiom(auditLog) {
    if (!axiomAudit || process.env.AXIOM_ENABLED !== 'true') return;

    try {
      // Usa il metodo HTTP pulito (già GDPR-compliant)
      // Audit logs vanno nel dataset real-time insieme a performance e security
      const dataset = process.env.AXIOM_REALTIME_DATASET || process.env.AXIOM_AUDIT_DATASET || 'real-time';
      return await this.sendAuditLogToAxiomHTTP(dataset, auditLog);
    } catch (error) {
      reportAuditDeliveryFailure(error?.response?.status);
      return false;
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
      // Se Axiom è abilitato, leggi da Axiom invece di PostgreSQL
      if (process.env.AXIOM_ENABLED === 'true') {
        const { getAuditLogs } = require('../utils/axiomQueryHelper');
        
        const logs = await getAuditLogs({
          userId,
          action: filters.action || null,
          resource: filters.resource || null,
          startTime: filters.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endTime: filters.toDate || new Date(),
          limit: filters.limit || 100,
          offset: filters.offset || 0
        });
        
        // Formatta i log per compatibilità con il formato precedente
        return logs.map(log => ({
          id: log._time || Date.now().toString(),
          action: log.action,
          resource: log.resource,
          resource_id: log.resource_id,
          details: log.details || null,
          ip_address: log.ip_address,
          user_agent: null, // Non più disponibile (rimosso per GDPR)
          timestamp: log._time || new Date().toISOString(),
          success: log.success,
          error_message: log.error_message
        }));
      }
      
      // Fallback a PostgreSQL se Axiom non è abilitato
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
      console.error('AUDIT_SERVICE_LOGS_READ_FAILED');
      throw error;
    }
  }

  /**
   * Ottiene statistiche di audit per un utente
   * @param {string} userId - ID utente
   */
  static async getUserAuditStats(userId) {
    try {
      // Se Axiom è abilitato, leggi da Axiom invece di PostgreSQL
      if (process.env.AXIOM_ENABLED === 'true') {
        const { getAuditLogs } = require('../utils/axiomQueryHelper');
        
        const logs = await getAuditLogs({
          userId,
          startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Ultimo anno
          endTime: new Date(),
          limit: 100000 // Limite alto per statistiche
        });
        
        // Calcola statistiche
        const statsByAction = {};
        logs.forEach(log => {
          if (!log.action) return;
          
          if (!statsByAction[log.action]) {
            statsByAction[log.action] = {
              action: log.action,
              count: 0,
              success_count: 0,
              error_count: 0,
              first_action: log._time,
              last_action: log._time
            };
          }
          
          statsByAction[log.action].count++;
          if (log.success === true) {
            statsByAction[log.action].success_count++;
          } else if (log.success === false) {
            statsByAction[log.action].error_count++;
          }
          
          const logTime = new Date(log._time || 0);
          const firstTime = new Date(statsByAction[log.action].first_action || 0);
          const lastTime = new Date(statsByAction[log.action].last_action || 0);
          
          if (logTime < firstTime || !statsByAction[log.action].first_action) {
            statsByAction[log.action].first_action = log._time;
          }
          if (logTime > lastTime || !statsByAction[log.action].last_action) {
            statsByAction[log.action].last_action = log._time;
          }
        });
        
        return Object.values(statsByAction).sort((a, b) => b.count - a.count);
      }
      
      // Fallback a PostgreSQL se Axiom non è abilitato
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
      console.error('AUDIT_SERVICE_STATS_READ_FAILED');
      throw error;
    }
  }

  /**
   * Pulisce i log di audit più vecchi di X giorni
   * @param {number} daysToKeep - Giorni da mantenere
   */
  static async cleanupOldLogs(daysToKeep = 365) {
    try {
      // Se Axiom è abilitato, la pulizia viene gestita automaticamente da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        console.log(`ℹ️  Con Axiom abilitato, la pulizia dei log viene gestita automaticamente da Axiom. Retention: ${daysToKeep} giorni`);
        return 0; // Non è necessario pulire manualmente
      }
      
      // La retention RP-10 non è stata approvata: nessuna DELETE locale implicita.
      const policyError = new Error('AUDIT_RETENTION_POLICY_NOT_APPROVED');
      policyError.code = 'AUDIT_RETENTION_POLICY_NOT_APPROVED';
      policyError.statusCode = 409;
      throw policyError;
    } catch (error) {
      console.error('AUDIT_SERVICE_CLEANUP_FAILED');
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
      console.error('AUDIT_SERVICE_PROCESSING_LIMITS_READ_FAILED');
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
      console.error('AUDIT_SERVICE_PROCESSING_LIMITS_WRITE_FAILED');
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
      console.error('AUDIT_SERVICE_SUSPICIOUS_READ_FAILED');
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
      console.error('AUDIT_SERVICE_GENERAL_STATS_FAILED');
      throw error;
    }
  }
}

module.exports = AuditService;
