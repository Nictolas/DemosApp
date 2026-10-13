/**
 * Servizio per l'invio di notifiche email per violazioni e alert
 */

const { pool } = require('../middleware/auth');
const AuditService = require('./auditService');
const OperationalAlertService = require('./operationalAlertService');

// Importazione condizionale del servizio email
let emailService;
try {
  emailService = require('./emailService');
} catch (error) {
  console.log('⚠️ Servizio email non disponibile per notifiche:', error.message);
  emailService = {
    sendEmail: async () => ({ success: false, error: 'Servizio email non disponibile' })
  };
}

class NotificationService {
  /**
   * Configurazione notifiche
   */
  static getNotificationConfig() {
    return {
      // Email degli admin
      adminEmails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : ['admin@demos.community'],
      
      // Soglie per invio notifiche
      thresholds: {
        CRITICAL: 1,    // Notifica immediata
        HIGH: 3,        // Notifica dopo 3 violazioni
        MEDIUM: 10      // Notifica dopo 10 violazioni
      },
      
      // Template email
      templates: {
        violation_alert: {
          subject: '🚨 Violazione Rilevata - DemosApp',
          template: 'violation-alert'
        },
        security_breach: {
          subject: '🔒 Violazione di Sicurezza - DemosApp',
          template: 'security-breach'
        },
        gdpr_violation: {
          subject: '⚖️ Violazione GDPR - DemosApp',
          template: 'gdpr-violation'
        },
        system_alert: {
          subject: '⚠️ Allerta Sistema - DemosApp',
          template: 'system-alert'
        }
      }
    };
  }

  /**
   * Invia notifica per violazione critica
   */
  static async sendCriticalViolationNotification(violation) {
    return OperationalAlertService.sendCriticalAlert({
      type: violation?.type || 'CRITICAL_VIOLATION',
      component: 'violation_monitoring',
      severity: violation?.severity || 'CRITICAL',
      code: violation?.code || ''
    });
  }

  /**
   * Invia notifica per violazione di sicurezza
   */
  static async sendSecurityBreachNotification(violation) {
    try {
      const config = this.getNotificationConfig();
      
      const emailData = {
        to: config.adminEmails,
        subject: config.templates.security_breach.subject,
        template: config.templates.security_breach.template,
        data: {
          violation: violation,
          timestamp: new Date().toISOString(),
          ip_address: violation.details.ip_address,
          user_id: violation.details.user_id,
          action_taken: this.getSecurityAction(violation.type)
        }
      };
      
      const result = await emailService.sendEmail(emailData);
      
      // Log della notifica
      await AuditService.logAction({
        userId: 'system',
        action: 'SECURITY_NOTIFICATION_SENT',
        resource: 'security',
        resourceId: violation.type,
        details: {
          violation_type: violation.type,
          ip_address: violation.details.ip_address,
          recipients: config.adminEmails,
          email_result: result
        },
        success: result.success
      });
      
      return result;
    } catch (error) {
      console.error('❌ Errore nell\'invio notifica violazione sicurezza:', error);
      throw error;
    }
  }

  /**
   * Invia notifica per violazione GDPR
   */
  static async sendGDPRViolationNotification(violation) {
    try {
      const config = this.getNotificationConfig();
      
      const emailData = {
        to: config.adminEmails,
        subject: config.templates.gdpr_violation.subject,
        template: config.templates.gdpr_violation.template,
        data: {
          violation: violation,
          timestamp: new Date().toISOString(),
          gdpr_article: this.getGDPRArticle(violation.type),
          legal_requirement: this.getLegalRequirement(violation.type),
          action_required: this.getGDPRAction(violation.type)
        }
      };
      
      const result = await emailService.sendEmail(emailData);
      
      // Log della notifica
      await AuditService.logAction({
        userId: 'system',
        action: 'GDPR_NOTIFICATION_SENT',
        resource: 'gdpr',
        resourceId: violation.type,
        details: {
          violation_type: violation.type,
          gdpr_article: this.getGDPRArticle(violation.type),
          recipients: config.adminEmails,
          email_result: result
        },
        success: result.success
      });
      
      return result;
    } catch (error) {
      console.error('❌ Errore nell\'invio notifica violazione GDPR:', error);
      throw error;
    }
  }

  /**
   * Invia notifica di sistema
   */
  static async sendSystemAlertNotification(alert) {
    return OperationalAlertService.sendCriticalAlert({
      type: alert?.type || 'SYSTEM_ALERT',
      component: alert?.component || 'system',
      severity: alert?.severity || 'CRITICAL',
      endpoint: alert?.endpoint || '',
      code: alert?.code || ''
    });
  }

  /**
   * Invia notifica di riepilogo giornaliero
   */
  static async sendDailySummaryNotification(summary) {
    try {
      const config = this.getNotificationConfig();
      
      const emailData = {
        to: config.adminEmails,
        subject: `📊 Riepilogo Giornaliero - DemosApp (${summary.date})`,
        template: 'daily-summary',
        data: {
          summary: summary,
          date: summary.date,
          total_violations: summary.total_violations,
          critical_violations: summary.critical_violations,
          high_violations: summary.high_violations,
          medium_violations: summary.medium_violations,
          system_health: summary.system_health
        }
      };
      
      const result = await emailService.sendEmail(emailData);
      
      return result;
    } catch (error) {
      console.error('❌ Errore nell\'invio riepilogo giornaliero:', error);
      throw error;
    }
  }

  /**
   * Invia notifica di escalation per violazioni gravi
   */
  static async sendEscalationNotification(violation, escalationLevel) {
    try {
      const config = this.getNotificationConfig();
      
      // Aggiungi email di escalation per violazioni critiche
      const escalationEmails = process.env.ESCALATION_EMAILS ? 
        process.env.ESCALATION_EMAILS.split(',') : config.adminEmails;
      
      const emailData = {
        to: escalationEmails,
        subject: `🚨 ESCALATION ${escalationLevel} - Violazione Critica - DemosApp`,
        template: 'escalation-alert',
        data: {
          violation: violation,
          escalation_level: escalationLevel,
          timestamp: new Date().toISOString(),
          immediate_action_required: true,
          escalation_reason: this.getEscalationReason(violation, escalationLevel)
        }
      };
      
      const result = await emailService.sendEmail(emailData);
      
      // Log dell'escalation
      await AuditService.logAction({
        userId: 'system',
        action: 'ESCALATION_NOTIFICATION_SENT',
        resource: 'escalation',
        resourceId: violation.type,
        details: {
          violation_type: violation.type,
          escalation_level: escalationLevel,
          recipients: escalationEmails,
          email_result: result
        },
        success: result.success
      });
      
      return result;
    } catch (error) {
      console.error('❌ Errore nell\'invio notifica escalation:', error);
      throw error;
    }
  }

  /**
   * Determina l'azione richiesta per tipo di violazione
   */
  static getActionRequired(violationType) {
    const actions = {
      'SECURITY_BREACH': 'Bloccare immediatamente l\'IP e sospendere l\'utente',
      'UNAUTHORIZED_ACCESS': 'Verificare i permessi e revocare accessi non autorizzati',
      'SUSPICIOUS_ACTIVITY': 'Monitorare l\'attività e investigare ulteriormente',
      'DATA_BREACH': 'Notificare immediatamente le autorità competenti (GDPR Art. 33)',
      'CONSENT_VIOLATION': 'Verificare e correggere le procedure di consenso',
      'RETENTION_VIOLATION': 'Correggere le policy di retention e pulire i dati',
      'AUDIT_FAILURE': 'Riparare il sistema di audit e verificare l\'integrità',
      'SYSTEM_ERROR': 'Investigare e risolvere l\'errore di sistema'
    };
    
    return actions[violationType] || 'Investigare e risolvere la violazione';
  }

  /**
   * Determina l'azione di sicurezza per tipo di violazione
   */
  static getSecurityAction(violationType) {
    const actions = {
      'SECURITY_BREACH': 'IP bloccato, utente sospeso, log analizzati',
      'UNAUTHORIZED_ACCESS': 'Accessi revocati, permessi verificati',
      'SUSPICIOUS_ACTIVITY': 'Attività monitorata, investigazione in corso',
      'SUSPICIOUS_IP': 'IP monitorato, accessi limitati'
    };
    
    return actions[violationType] || 'Azione di sicurezza applicata';
  }

  /**
   * Determina l'articolo GDPR per tipo di violazione
   */
  static getGDPRArticle(violationType) {
    const articles = {
      'DATA_BREACH': 'Art. 33 - Notifica violazione',
      'CONSENT_VIOLATION': 'Art. 7 - Condizioni per il consenso',
      'RETENTION_VIOLATION': 'Art. 5(1)(e) - Limitazione della conservazione',
      'UNAUTHORIZED_ACCESS': 'Art. 32 - Sicurezza del trattamento'
    };
    
    return articles[violationType] || 'GDPR - Violazione rilevata';
  }

  /**
   * Determina il requisito legale per tipo di violazione
   */
  static getLegalRequirement(violationType) {
    const requirements = {
      'DATA_BREACH': 'Notifica entro 72 ore alle autorità competenti',
      'CONSENT_VIOLATION': 'Verifica e correzione delle procedure di consenso',
      'RETENTION_VIOLATION': 'Implementazione corretta delle policy di retention',
      'UNAUTHORIZED_ACCESS': 'Implementazione di controlli di accesso appropriati'
    };
    
    return requirements[violationType] || 'Conformità GDPR richiesta';
  }

  /**
   * Determina l'azione GDPR per tipo di violazione
   */
  static getGDPRAction(violationType) {
    const actions = {
      'DATA_BREACH': 'Notifica immediata alle autorità e agli interessati',
      'CONSENT_VIOLATION': 'Correzione delle procedure e notifica agli interessati',
      'RETENTION_VIOLATION': 'Correzione delle policy e pulizia dei dati',
      'UNAUTHORIZED_ACCESS': 'Implementazione di controlli di accesso e audit'
    };
    
    return actions[violationType] || 'Azione GDPR richiesta';
  }

  /**
   * Determina i passi di risoluzione per tipo di alert
   */
  static getResolutionSteps(alertType) {
    const steps = {
      'DATABASE_ERROR': [
        'Verificare la connessione al database',
        'Controllare i log del database',
        'Verificare le credenziali',
        'Riavviare il servizio se necessario'
      ],
      'EMAIL_ERROR': [
        'Verificare la configurazione SMTP',
        'Controllare le credenziali email',
        'Verificare la connessione internet',
        'Testare l\'invio email'
      ],
      'AUDIT_ERROR': [
        'Verificare la connessione al database',
        'Controllare i permessi di scrittura',
        'Verificare la configurazione audit',
        'Riavviare il servizio audit'
      ]
    };
    
    return steps[alertType] || ['Investigare l\'errore', 'Consultare i log', 'Contattare il supporto'];
  }

  /**
   * Determina la ragione dell'escalation
   */
  static getEscalationReason(violation, escalationLevel) {
    const reasons = {
      1: 'Violazione critica rilevata - Richiede attenzione immediata',
      2: 'Violazione non risolta entro il tempo limite - Escalation a livello superiore',
      3: 'Violazione persistente - Richiede intervento del management'
    };
    
    return reasons[escalationLevel] || 'Escalation richiesta per violazione critica';
  }
}

module.exports = NotificationService;
