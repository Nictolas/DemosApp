/**
 * Servizio per il rilevamento automatico di violazioni di sicurezza e conformità GDPR
 */

const { pool } = require('../middleware/auth');
const AuditService = require('./auditService');
const { getAuditLogs } = require('../utils/axiomQueryHelper');

class ViolationDetectionService {
  /**
   * Tipi di violazioni rilevabili
   */
  static getViolationTypes() {
    return {
      // Violazioni di sicurezza
      SECURITY_BREACH: {
        severity: 'CRITICAL',
        description: 'Violazione di sicurezza rilevata',
        threshold: 1,
        action: 'IMMEDIATE_NOTIFICATION'
      },
      
      UNAUTHORIZED_ACCESS: {
        severity: 'HIGH',
        description: 'Accesso non autorizzato ai dati',
        threshold: 3,
        action: 'NOTIFY_ADMIN'
      },
      
      SUSPICIOUS_ACTIVITY: {
        severity: 'MEDIUM',
        description: 'Attività sospetta rilevata',
        threshold: 10,
        action: 'LOG_AND_MONITOR'
      },
      
      // Violazioni GDPR
      DATA_BREACH: {
        severity: 'CRITICAL',
        description: 'Violazione dei dati personali (GDPR Art. 33)',
        threshold: 1,
        action: 'IMMEDIATE_NOTIFICATION'
      },
      
      CONSENT_VIOLATION: {
        severity: 'HIGH',
        description: 'Violazione del consenso GDPR',
        threshold: 5,
        action: 'NOTIFY_ADMIN'
      },
      
      RETENTION_VIOLATION: {
        severity: 'MEDIUM',
        description: 'Violazione delle policy di retention',
        threshold: 1,
        action: 'LOG_AND_MONITOR'
      },
      
      // Violazioni di conformità
      AUDIT_FAILURE: {
        severity: 'HIGH',
        description: 'Fallimento nel sistema di audit',
        threshold: 1,
        action: 'NOTIFY_ADMIN'
      },
      
      SYSTEM_ERROR: {
        severity: 'MEDIUM',
        description: 'Errore di sistema critico',
        threshold: 5,
        action: 'LOG_AND_MONITOR'
      }
    };
  }

  /**
   * Rileva violazioni di sicurezza
   */
  static async detectSecurityViolations() {
    try {
      const violations = [];
      
      // 1. Rileva accessi non autorizzati
      const unauthorizedAccess = await this.detectUnauthorizedAccess();
      violations.push(...unauthorizedAccess);
      
      // 2. Rileva attività sospette
      const suspiciousActivity = await this.detectSuspiciousActivity();
      violations.push(...suspiciousActivity);
      
      // 3. Rileva tentativi di accesso falliti
      const failedAccess = await this.detectFailedAccess();
      violations.push(...failedAccess);
      
      // 4. Rileva accessi da IP sospetti
      const suspiciousIPs = await this.detectSuspiciousIPs();
      violations.push(...suspiciousIPs);
      
      return violations;
    } catch (error) {
      console.error('❌ Errore nel rilevamento violazioni di sicurezza:', error);
      throw error;
    }
  }

  /**
   * Rileva violazioni GDPR
   */
  static async detectGDPRViolations() {
    try {
      const violations = [];
      
      // 1. Rileva violazioni dei dati personali
      const dataBreaches = await this.detectDataBreaches();
      violations.push(...dataBreaches);
      
      // 2. Rileva violazioni del consenso
      const consentViolations = await this.detectConsentViolations();
      violations.push(...consentViolations);
      
      // 3. Rileva violazioni di retention
      const retentionViolations = await this.detectRetentionViolations();
      violations.push(...retentionViolations);
      
      // 4. Rileva accessi non autorizzati ai dati personali
      const unauthorizedDataAccess = await this.detectUnauthorizedDataAccess();
      violations.push(...unauthorizedDataAccess);
      
      return violations;
    } catch (error) {
      console.error('❌ Errore nel rilevamento violazioni GDPR:', error);
      throw error;
    }
  }

  /**
   * Rileva accessi non autorizzati
   */
  static async detectUnauthorizedAccess() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          action: 'DATA_ACCESS',
          startTime,
          endTime,
          limit: 100000
        });
        
        // Filtra e raggruppa
        const unauthorizedAccess = {};
        logs.forEach(log => {
          if (log.resource === 'users' && 
              log.resource_id && 
              log.user_id &&
              log.resource_id !== log.user_id) {
            const key = `${log.user_id}-${log.ip_address}-${log.resource_id}`;
            if (!unauthorizedAccess[key]) {
              unauthorizedAccess[key] = {
                user_id: log.user_id,
                ip_address: log.ip_address,
                action: log.action,
                resource: log.resource,
                resource_id: log.resource_id,
                access_count: 0,
                last_access: log._time
              };
            }
            unauthorizedAccess[key].access_count++;
            const logTime = new Date(log._time || 0);
            const lastTime = new Date(unauthorizedAccess[key].last_access || 0);
            if (logTime > lastTime) {
              unauthorizedAccess[key].last_access = log._time;
            }
          }
        });
        
        return Object.values(unauthorizedAccess)
          .filter(item => item.access_count > 3)
          .sort((a, b) => b.access_count - a.access_count)
          .map(item => ({
            type: 'UNAUTHORIZED_ACCESS',
            severity: 'HIGH',
            description: `Accesso non autorizzato ai dati di utente ${item.resource_id}`,
            details: {
              user_id: item.user_id,
              ip_address: item.ip_address,
              target_user: item.resource_id,
              access_count: item.access_count,
              last_access: item.last_access
            },
            timestamp: new Date()
          }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          user_id,
          ip_address,
          action,
          resource,
          resource_id,
          COUNT(*) as access_count,
          MAX(timestamp) as last_access
        FROM audit_logs 
        WHERE action = 'DATA_ACCESS' 
          AND resource = 'users'
          AND resource_id IS NOT NULL
          AND resource_id != user_id
          AND timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY user_id, ip_address, action, resource, resource_id
        HAVING COUNT(*) > 3
        ORDER BY access_count DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `Accesso non autorizzato ai dati di utente ${row.resource_id}`,
        details: {
          user_id: row.user_id,
          ip_address: row.ip_address,
          target_user: row.resource_id,
          access_count: row.access_count,
          last_access: row.last_access
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento accessi non autorizzati:', error);
      return [];
    }
  }

  /**
   * Rileva attività sospette
   */
  static async detectSuspiciousActivity() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          startTime: oneHourAgo,
          endTime,
          limit: 100000
        });
        
        // Raggruppa per user_id e ip_address
        const activityByUser = {};
        logs.forEach(log => {
          if (!log.user_id || !log.ip_address) return;
          const key = `${log.user_id}-${log.ip_address}`;
          if (!activityByUser[key]) {
            activityByUser[key] = {
              user_id: log.user_id,
              ip_address: log.ip_address,
              action_count: 0,
              failed_count: 0,
              last_activity: log._time
            };
          }
          activityByUser[key].action_count++;
          if (log.success === false) {
            activityByUser[key].failed_count++;
          }
          const logTime = new Date(log._time || 0);
          const lastTime = new Date(activityByUser[key].last_activity || 0);
          if (logTime > lastTime) {
            activityByUser[key].last_activity = log._time;
          }
        });
        
        return Object.values(activityByUser)
          .filter(item => item.action_count > 50 || item.failed_count > 20)
          .sort((a, b) => b.action_count - a.action_count)
          .map(item => ({
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'MEDIUM',
            description: `Attività sospetta rilevata: ${item.action_count} azioni in 1 ora`,
            details: {
              user_id: item.user_id,
              ip_address: item.ip_address,
              action_count: item.action_count,
              failed_count: item.failed_count,
              last_activity: item.last_activity
            },
            timestamp: new Date()
          }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          user_id,
          ip_address,
          COUNT(*) as action_count,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_count,
          MAX(timestamp) as last_activity
        FROM audit_logs 
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
        GROUP BY user_id, ip_address
        HAVING COUNT(*) > 50 OR COUNT(CASE WHEN success = false THEN 1 END) > 20
        ORDER BY action_count DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        description: `Attività sospetta rilevata: ${row.action_count} azioni in 1 ora`,
        details: {
          user_id: row.user_id,
          ip_address: row.ip_address,
          action_count: row.action_count,
          failed_count: row.failed_count,
          last_activity: row.last_activity
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento attività sospette:', error);
      return [];
    }
  }

  /**
   * Rileva tentativi di accesso falliti
   */
  static async detectFailedAccess() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          action: 'AUTH_OPERATION',
          success: false,
          startTime: oneHourAgo,
          endTime,
          limit: 100000
        });
        
        // Raggruppa per user_id e ip_address
        const failedByUser = {};
        logs.forEach(log => {
          if (!log.user_id || !log.ip_address) return;
          const key = `${log.user_id}-${log.ip_address}`;
          if (!failedByUser[key]) {
            failedByUser[key] = {
              user_id: log.user_id,
              ip_address: log.ip_address,
              failed_count: 0,
              last_attempt: log._time
            };
          }
          failedByUser[key].failed_count++;
          const logTime = new Date(log._time || 0);
          const lastTime = new Date(failedByUser[key].last_attempt || 0);
          if (logTime > lastTime) {
            failedByUser[key].last_attempt = log._time;
          }
        });
        
        return Object.values(failedByUser)
          .filter(item => item.failed_count > 10)
          .sort((a, b) => b.failed_count - a.failed_count)
          .map(item => ({
            type: 'SECURITY_BREACH',
            severity: 'CRITICAL',
            description: `Tentativi di accesso falliti: ${item.failed_count} in 1 ora`,
            details: {
              user_id: item.user_id,
              ip_address: item.ip_address,
              failed_count: item.failed_count,
              last_attempt: item.last_attempt
            },
            timestamp: new Date()
          }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          user_id,
          ip_address,
          COUNT(*) as failed_count,
          MAX(timestamp) as last_attempt
        FROM audit_logs 
        WHERE success = false 
          AND action = 'AUTH_OPERATION'
          AND timestamp >= NOW() - INTERVAL '1 hour'
        GROUP BY user_id, ip_address
        HAVING COUNT(*) > 10
        ORDER BY failed_count DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'SECURITY_BREACH',
        severity: 'CRITICAL',
        description: `Tentativi di accesso falliti: ${row.failed_count} in 1 ora`,
        details: {
          user_id: row.user_id,
          ip_address: row.ip_address,
          failed_count: row.failed_count,
          last_attempt: row.last_attempt
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento accessi falliti:', error);
      return [];
    }
  }

  /**
   * Rileva IP sospetti
   */
  static async detectSuspiciousIPs() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          startTime,
          endTime,
          limit: 100000
        });
        
        // Raggruppa per IP
        const ipStats = {};
        logs.forEach(log => {
          if (!log.ip_address) return;
          if (!ipStats[log.ip_address]) {
            ipStats[log.ip_address] = {
              ip_address: log.ip_address,
              users: new Set(),
              total_actions: 0,
              last_activity: log._time
            };
          }
          if (log.user_id) {
            ipStats[log.ip_address].users.add(log.user_id);
          }
          ipStats[log.ip_address].total_actions++;
          const logTime = new Date(log._time || 0);
          const lastTime = new Date(ipStats[log.ip_address].last_activity || 0);
          if (logTime > lastTime) {
            ipStats[log.ip_address].last_activity = log._time;
          }
        });
        
        return Object.values(ipStats)
          .filter(item => item.users.size > 5)
          .sort((a, b) => b.users.size - a.users.size || b.total_actions - a.total_actions)
          .map(item => ({
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'MEDIUM',
            description: `IP sospetto: ${item.users.size} utenti diversi da ${item.ip_address}`,
            details: {
              ip_address: item.ip_address,
              unique_users: item.users.size,
              total_actions: item.total_actions,
              last_activity: item.last_activity
            },
            timestamp: new Date()
          }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          ip_address,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) as total_actions,
          MAX(timestamp) as last_activity
        FROM audit_logs 
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
          AND ip_address IS NOT NULL
        GROUP BY ip_address
        HAVING COUNT(DISTINCT user_id) > 5
        ORDER BY unique_users DESC, total_actions DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        description: `IP sospetto: ${row.unique_users} utenti diversi da ${row.ip_address}`,
        details: {
          ip_address: row.ip_address,
          unique_users: row.unique_users,
          total_actions: row.total_actions,
          last_activity: row.last_activity
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento IP sospetti:', error);
      return [];
    }
  }

  /**
   * Rileva violazioni dei dati personali
   */
  static async detectDataBreaches() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          action: 'DATA_DELETE',
          resource: 'users',
          startTime,
          endTime,
          limit: 100000
        });
        
        // Filtra per breach nei details
        const breaches = logs.filter(log => {
          const details = JSON.stringify(log.details || {}).toLowerCase();
          return details.includes('breach');
        });
        
        return breaches.map(log => ({
          type: 'DATA_BREACH',
          severity: 'CRITICAL',
          description: 'Possibile violazione dei dati personali rilevata',
          details: {
            user_id: log.user_id,
            action: log.action,
            resource: log.resource,
            details: log.details,
            timestamp: log._time
          },
          timestamp: new Date()
        }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          user_id,
          action,
          resource,
          details,
          timestamp
        FROM audit_logs 
        WHERE action = 'DATA_DELETE'
          AND resource = 'users'
          AND details::text LIKE '%breach%'
          AND timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'DATA_BREACH',
        severity: 'CRITICAL',
        description: 'Possibile violazione dei dati personali rilevata',
        details: {
          user_id: row.user_id,
          action: row.action,
          resource: row.resource,
          details: row.details,
          timestamp: row.timestamp
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento violazioni dati:', error);
      return [];
    }
  }

  /**
   * Rileva violazioni del consenso
   */
  static async detectConsentViolations() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          action: 'CONSENT_CHANGE',
          startTime,
          endTime,
          limit: 100000
        });
        
        // Filtra per violation nei details
        const violations = logs.filter(log => {
          const details = JSON.stringify(log.details || {}).toLowerCase();
          return details.includes('violation');
        });
        
        return violations.map(log => ({
          type: 'CONSENT_VIOLATION',
          severity: 'HIGH',
          description: 'Violazione del consenso GDPR rilevata',
          details: {
            user_id: log.user_id,
            action: log.action,
            details: log.details,
            timestamp: log._time
          },
          timestamp: new Date()
        }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          user_id,
          action,
          details,
          timestamp
        FROM audit_logs 
        WHERE action = 'CONSENT_CHANGE'
          AND details::text LIKE '%violation%'
          AND timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'CONSENT_VIOLATION',
        severity: 'HIGH',
        description: 'Violazione del consenso GDPR rilevata',
        details: {
          user_id: row.user_id,
          action: row.action,
          details: row.details,
          timestamp: row.timestamp
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento violazioni consenso:', error);
      return [];
    }
  }

  /**
   * Rileva violazioni di retention
   */
  static async detectRetentionViolations() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          action: 'DATA_RETENTION_DELETE',
          success: false,
          startTime,
          endTime,
          limit: 100000
        });
        
        return logs.map(log => ({
          type: 'RETENTION_VIOLATION',
          severity: 'MEDIUM',
          description: 'Violazione delle policy di retention rilevata',
          details: {
            user_id: log.user_id,
            action: log.action,
            resource: log.resource,
            details: log.details,
            timestamp: log._time
          },
          timestamp: new Date()
        }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          user_id,
          action,
          resource,
          details,
          timestamp
        FROM audit_logs 
        WHERE action = 'DATA_RETENTION_DELETE'
          AND success = false
          AND timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'RETENTION_VIOLATION',
        severity: 'MEDIUM',
        description: 'Violazione delle policy di retention rilevata',
        details: {
          user_id: row.user_id,
          action: row.action,
          resource: row.resource,
          details: row.details,
          timestamp: row.timestamp
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento violazioni retention:', error);
      return [];
    }
  }

  /**
   * Rileva accessi non autorizzati ai dati personali
   */
  static async detectUnauthorizedDataAccess() {
    try {
      // Se Axiom è abilitato, leggi da Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getAuditLogs({
          action: 'DATA_ACCESS',
          startTime,
          endTime,
          limit: 100000
        });
        
        // Filtra e raggruppa
        const unauthorizedAccess = {};
        logs.forEach(log => {
          if (['users', 'opinions', 'votes'].includes(log.resource) &&
              log.resource_id &&
              log.user_id &&
              log.resource_id !== log.user_id) {
            const key = `${log.user_id}-${log.ip_address}-${log.resource}-${log.resource_id}`;
            if (!unauthorizedAccess[key]) {
              unauthorizedAccess[key] = {
                user_id: log.user_id,
                ip_address: log.ip_address,
                action: log.action,
                resource: log.resource,
                resource_id: log.resource_id,
                access_count: 0,
                last_access: log._time
              };
            }
            unauthorizedAccess[key].access_count++;
            const logTime = new Date(log._time || 0);
            const lastTime = new Date(unauthorizedAccess[key].last_access || 0);
            if (logTime > lastTime) {
              unauthorizedAccess[key].last_access = log._time;
            }
          }
        });
        
        return Object.values(unauthorizedAccess)
          .filter(item => item.access_count > 2)
          .sort((a, b) => b.access_count - a.access_count)
          .map(item => ({
            type: 'UNAUTHORIZED_ACCESS',
            severity: 'HIGH',
            description: `Accesso non autorizzato ai dati personali: ${item.resource}`,
            details: {
              user_id: item.user_id,
              ip_address: item.ip_address,
              resource: item.resource,
              target_id: item.resource_id,
              access_count: item.access_count,
              last_access: item.last_access
            },
            timestamp: new Date()
          }));
      }
      
      // Fallback a Neon
      const query = `
        SELECT 
          user_id,
          ip_address,
          action,
          resource,
          resource_id,
          COUNT(*) as access_count,
          MAX(timestamp) as last_access
        FROM audit_logs 
        WHERE action = 'DATA_ACCESS' 
          AND resource IN ('users', 'opinions', 'votes')
          AND resource_id IS NOT NULL
          AND resource_id != user_id
          AND timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY user_id, ip_address, action, resource, resource_id
        HAVING COUNT(*) > 2
        ORDER BY access_count DESC
      `;
      
      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `Accesso non autorizzato ai dati personali: ${row.resource}`,
        details: {
          user_id: row.user_id,
          ip_address: row.ip_address,
          resource: row.resource,
          target_id: row.resource_id,
          access_count: row.access_count,
          last_access: row.last_access
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('❌ Errore nel rilevamento accessi non autorizzati ai dati:', error);
      return [];
    }
  }

  /**
   * Esegue rilevamento completo di tutte le violazioni
   */
  static async detectAllViolations() {
    try {
      console.log('🔍 Avvio rilevamento violazioni...');
      
      const [securityViolations, gdprViolations] = await Promise.all([
        this.detectSecurityViolations(),
        this.detectGDPRViolations()
      ]);
      
      const allViolations = [...securityViolations, ...gdprViolations];
      
      // Classifica per severità
      const criticalViolations = allViolations.filter(v => v.severity === 'CRITICAL');
      const highViolations = allViolations.filter(v => v.severity === 'HIGH');
      const mediumViolations = allViolations.filter(v => v.severity === 'MEDIUM');
      
      console.log(`✅ Rilevamento completato: ${allViolations.length} violazioni trovate`);
      console.log(`🚨 Critiche: ${criticalViolations.length}`);
      console.log(`⚠️ Alte: ${highViolations.length}`);
      console.log(`ℹ️ Medie: ${mediumViolations.length}`);
      
      return {
        total: allViolations.length,
        critical: criticalViolations.length,
        high: highViolations.length,
        medium: mediumViolations.length,
        violations: allViolations
      };
    } catch (error) {
      console.error('❌ Errore nel rilevamento violazioni:', error);
      throw error;
    }
  }
}

module.exports = ViolationDetectionService;
