const { Pool } = require('pg');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * 🛡️ Sistema di Monitoraggio Sicurezza Avanzato
 * 
 * Funzionalità:
 * - Rilevamento tentativi di accesso sospetti
 * - Monitoraggio query anomale
 * - Alerting per violazioni di sicurezza
 * - Logging strutturato per audit
 */

class SecurityMonitor {
  constructor() {
    this.suspiciousIPs = new Map();
    this.failedLogins = new Map();
    this.alertThresholds = {
      failedLogins: 5, // 5 tentativi falliti in 15 minuti
      suspiciousRequests: 20, // 20 richieste sospette in 15 minuti
      adminAccess: 10 // 10 accessi admin in 15 minuti
    };
  }

  /**
   * Registra tentativo di login fallito
   */
  async recordFailedLogin(ip, email, userAgent) {
    const key = `${ip}:${email}`;
    const now = Date.now();
    
    if (!this.failedLogins.has(key)) {
      this.failedLogins.set(key, []);
    }
    
    const attempts = this.failedLogins.get(key);
    attempts.push(now);
    
    // Mantieni solo gli ultimi 15 minuti
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    const recentAttempts = attempts.filter(time => time > fifteenMinutesAgo);
    this.failedLogins.set(key, recentAttempts);

    // Salva nel database
    await this.saveSecurityEvent({
      type: 'failed_login',
      ip_address: ip,
      user_email: email,
      user_agent: userAgent,
      severity: 'medium',
      details: {
        attempt_count: recentAttempts.length,
        time_window: '15_minutes'
      }
    });

    // Alert se supera la soglia
    if (recentAttempts.length >= this.alertThresholds.failedLogins) {
      await this.triggerAlert('brute_force_attempt', {
        ip,
        email,
        attempts: recentAttempts.length,
        timeWindow: '15_minutes'
      });
    }

    return recentAttempts.length;
  }

  /**
   * Registra accesso admin
   */
  async recordAdminAccess(ip, userId, action, userAgent) {
    const key = `admin:${ip}`;
    const now = Date.now();
    
    if (!this.suspiciousIPs.has(key)) {
      this.suspiciousIPs.set(key, []);
    }
    
    const accesses = this.suspiciousIPs.get(key);
    accesses.push({ time: now, userId, action });
    
    // Mantieni solo gli ultimi 15 minuti
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    const recentAccesses = accesses.filter(access => access.time > fifteenMinutesAgo);
    this.suspiciousIPs.set(key, recentAccesses);

    // Salva nel database
    await this.saveSecurityEvent({
      type: 'admin_access',
      ip_address: ip,
      user_id: userId,
      user_agent: userAgent,
      severity: 'low',
      details: {
        action,
        access_count: recentAccesses.length,
        time_window: '15_minutes'
      }
    });

    // Alert se supera la soglia
    if (recentAccesses.length >= this.alertThresholds.adminAccess) {
      await this.triggerAlert('excessive_admin_access', {
        ip,
        userId,
        accesses: recentAccesses.length,
        timeWindow: '15_minutes'
      });
    }
  }

  /**
   * Rileva richieste sospette
   */
  async detectSuspiciousRequest(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const now = Date.now();
    
    // Controlla pattern sospetti
    const suspiciousPatterns = [
      /\.\.\//, // Directory traversal
      /<script/i, // XSS
      /union.*select/i, // SQL injection
      /drop.*table/i, // SQL injection
      /exec\(/i, // Command injection
      /eval\(/i, // Code injection
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(req.url) || 
      pattern.test(JSON.stringify(req.body)) ||
      pattern.test(JSON.stringify(req.query))
    );

    if (isSuspicious) {
      await this.saveSecurityEvent({
        type: 'suspicious_request',
        ip_address: ip,
        user_agent: userAgent,
        severity: 'high',
        details: {
          url: req.url,
          method: req.method,
          body: JSON.stringify(req.body),
          query: JSON.stringify(req.query),
          headers: JSON.stringify(req.headers)
        }
      });

      await this.triggerAlert('suspicious_request_detected', {
        ip,
        url: req.url,
        method: req.method,
        userAgent
      });

      return res.status(400).json({
        success: false,
        error: 'Richiesta sospetta rilevata',
        message: 'La richiesta è stata bloccata per motivi di sicurezza'
      });
    }

    next();
  }

  /**
   * Salva evento di sicurezza nel database
   * DISABILITATO: I security events vengono salvati solo su Axiom, non più su Neon
   * Questo per alleggerire Neon e centralizzare i log su Axiom
   */
  async saveSecurityEvent(event) {
    try {
      // DISABILITATO: I security events vengono salvati solo su Axiom, non più su Neon
      // Questo per alleggerire Neon e centralizzare i log su Axiom
      if (process.env.AXIOM_ENABLED === 'true') {
        // Se Axiom è abilitato, invia solo ad Axiom (non blocca se fallisce)
        this.sendSecurityEventToAxiom(event).catch(() => {});
        console.log(`🔒 Security event inviato ad Axiom: ${event.type} per utente ${event.user_id || 'anonimo'}`);
        return;
      }
      
      // Solo se Axiom non è abilitato, salva su Neon (fallback)
      const query = `
        INSERT INTO security_events (
          type, ip_address, user_id, user_email, user_agent,
          severity, details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `;
      
      await pool.query(query, [
        event.type,
        event.ip_address,
        event.user_id || null,
        event.user_email || null,
        event.user_agent,
        event.severity,
        JSON.stringify(event.details)
      ]);
      
      // Invia anche ad Axiom (dataset real-time) se disponibile
      this.sendSecurityEventToAxiom(event).catch(() => {});
    } catch (error) {
      console.error('❌ Errore salvataggio evento sicurezza:', error);
    }
  }

  /**
   * Invia security event ad Axiom (dataset real-time)
   */
  async sendSecurityEventToAxiom(event) {
    // Axiom integration per security events
    let Axiom;
    let axiomSecurity;
    try {
      Axiom = require('@axiomhq/axiom-node');
      if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
        axiomSecurity = new Axiom({
          token: process.env.AXIOM_API_TOKEN,
          orgId: process.env.AXIOM_ORG_ID,
          region: process.env.AXIOM_REGION || 'eu'
        });
      }
    } catch (error) {
      axiomSecurity = null;
    }

    if (!axiomSecurity || process.env.AXIOM_ENABLED !== 'true') return;

    try {
      // Genera session_id se non disponibile (per coerenza con centralized_logs)
      let sessionId = event.session_id || null;
      if (!sessionId && event.user_id) {
        const crypto = require('crypto');
        // Usa user_id + finestra temporale di 24 ore (stesso approccio di centralized_logs)
        const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
        const sessionKey = `${event.user_id}-${timeWindow}`;
        sessionId = crypto
          .createHash('sha256')
          .update(sessionKey)
          .digest('hex')
          .substring(0, 16);
        sessionId = `security_${sessionId}`; // Prefisso per security events
      }
      
      // Pulisci details per mantenere solo campi essenziali GDPR
      let cleanedDetails = null;
      if (event.details && typeof event.details === 'object') {
        cleanedDetails = {};
        // Mantieni solo campi essenziali per GDPR
        if (event.details.message) cleanedDetails.message = event.details.message;
        // Rimuovi campi non essenziali come endpoint, url, method, body, query, headers, etc.
        // (non obbligatori per GDPR - già coperti da type e severity)
      } else if (event.details && typeof event.details === 'string') {
        // Se details è una stringa, mantienila (può essere un messaggio di errore)
        cleanedDetails = event.details;
      }
      
      // Invia SOLO i campi obbligatori per GDPR (minimizzazione dati)
      // Campi GDPR obbligatori per security: _time, user_id, ip_address, type, severity, details (solo essenziali), session_id
      const logEntry = {
        _time: new Date().toISOString(),        // GDPR: Quando è successo
        user_id: event.user_id || null,         // GDPR: Chi (se disponibile)
        ip_address: event.ip_address || null,   // GDPR: Da dove (da anonimizzare)
        type: event.type || null,               // GDPR: Tipo evento sicurezza
        severity: event.severity || null,        // GDPR: Gravità evento
        details: cleanedDetails,                 // GDPR: Dettagli evento (solo essenziali: message)
        session_id: sessionId || null           // GDPR: Identifica la sessione utente
      };
      
      // NOTA: Campi rimossi (non obbligatori per GDPR):
      // - log_type: categorizzazione non obbligatoria
      // - user_email: non obbligatorio (abbiamo user_id)
      // - user_agent: non obbligatorio per GDPR
      // - details.endpoint, details.url, details.method, details.body, details.query, details.headers: non obbligatori

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
      const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
      axiomSecurity.ingestEvents(dataset, [logEntry])
        .catch(err => {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Errore invio security event Axiom:', err.message);
          }
        });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Errore preparazione security event Axiom:', error);
      }
    }
  }

  /**
   * Trigger alert per eventi critici
   */
  async triggerAlert(alertType, data) {
    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      data,
      severity: this.getAlertSeverity(alertType)
    };

    // Log dell'alert
    console.log(`🚨 SECURITY ALERT [${alert.severity.toUpperCase()}]:`, alert);

    // Salva alert nel database
    try {
      await pool.query(`
        INSERT INTO security_alerts (type, data, severity, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [alertType, JSON.stringify(data), alert.severity]);
    } catch (error) {
      console.error('❌ Errore salvataggio alert:', error);
    }

    // In produzione, inviare notifiche (email, Slack, etc.)
    if (process.env.NODE_ENV === 'production') {
      await this.sendSecurityNotification(alert);
    }
  }

  /**
   * Determina severità dell'alert
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      'brute_force_attempt': 'high',
      'suspicious_request_detected': 'critical',
      'excessive_admin_access': 'medium',
      'rate_limit_exceeded': 'low'
    };
    return severityMap[alertType] || 'medium';
  }

  /**
   * Invia notifica di sicurezza
   */
  async sendSecurityNotification(alert) {
    // Implementare invio notifiche (email, Slack, Discord, etc.)
    console.log(`📧 SECURITY NOTIFICATION: ${alert.type} - ${alert.severity}`);
  }

  /**
   * Pulisce cache in memoria
   */
  cleanup() {
    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    
    // Pulisce tentativi di login falliti
    for (const [key, attempts] of this.failedLogins.entries()) {
      const recentAttempts = attempts.filter(time => time > fifteenMinutesAgo);
      if (recentAttempts.length === 0) {
        this.failedLogins.delete(key);
      } else {
        this.failedLogins.set(key, recentAttempts);
      }
    }
    
    // Pulisce accessi sospetti
    for (const [key, accesses] of this.suspiciousIPs.entries()) {
      const recentAccesses = accesses.filter(access => access.time > fifteenMinutesAgo);
      if (recentAccesses.length === 0) {
        this.suspiciousIPs.delete(key);
      } else {
        this.suspiciousIPs.set(key, recentAccesses);
      }
    }
  }
}

// Istanza singleton
const securityMonitor = new SecurityMonitor();

// Cleanup ogni 5 minuti - salva riferimento per cleanup graceful
let cleanupInterval = setInterval(() => {
  try {
    securityMonitor.cleanup();
  } catch (error) {
    console.error('❌ Errore nel cleanup securityMonitor:', error);
  }
}, 5 * 60 * 1000);

// Funzione per pulire l'interval (per shutdown graceful)
const stopSecurityMonitoring = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('🔌 Security monitoring cleanup fermato');
  }
};

module.exports = {
  securityMonitor,
  recordFailedLogin: (ip, email, userAgent) => securityMonitor.recordFailedLogin(ip, email, userAgent),
  recordAdminAccess: (ip, userId, action, userAgent) => securityMonitor.recordAdminAccess(ip, userId, action, userAgent),
  stopSecurityMonitoring,
  detectSuspiciousRequest: (req, res, next) => securityMonitor.detectSuspiciousRequest(req, res, next)
};
