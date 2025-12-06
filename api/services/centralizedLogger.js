// File: api/services/centralizedLogger.js
const { pool } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// Axiom integration (opzionale)
let Axiom;
let axiom;
try {
  const axiomModule = require('@axiomhq/axiom-node');
  if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
    // Usa Client se disponibile, altrimenti usa direttamente il modulo
    if (axiomModule.Client) {
      axiom = new axiomModule.Client({
        token: process.env.AXIOM_API_TOKEN,
        orgId: process.env.AXIOM_ORG_ID,
        region: process.env.AXIOM_REGION || 'eu'
      });
    } else {
      // Fallback: usa direttamente il modulo (metodo deprecato)
      axiom = axiomModule;
      axiom.token = process.env.AXIOM_API_TOKEN;
      axiom.orgId = process.env.AXIOM_ORG_ID;
      axiom.region = process.env.AXIOM_REGION || 'eu';
    }
  }
} catch (error) {
  // Axiom SDK non installato, continua senza
  axiom = null;
}

class CentralizedLogger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };
    
    // Mappatura per codici ottimizzati
    this.levelMapping = {
      'ERROR': 'E',
      'WARN': 'W',
      'INFO': 'I',
      'DEBUG': 'D',
      'TRACE': 'T'
    };
    
    this.reverseMapping = {
      'E': 'ERROR',
      'W': 'WARN',
      'I': 'INFO',
      'D': 'DEBUG',
      'T': 'TRACE'
    };
    
    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
    this.logToFile = process.env.LOG_TO_FILE === 'true';
    this.logToDatabase = process.env.LOG_TO_DATABASE !== 'false';
    this.logToConsole = process.env.LOG_TO_CONSOLE !== 'false';
    this.logToAxiom = process.env.AXIOM_ENABLED === 'true' && axiom !== null;
    
    this.logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
    this.maxFileSize = parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'); // 10MB
    this.maxFiles = parseInt(process.env.LOG_MAX_FILES || '5');
    
    this.axiomDataset = process.env.AXIOM_DATASET || 'centralized_logs';
    this.axiomClient = axiom;
    
    this.initializeLogDirectory();
  }

  async initializeLogDirectory() {
    if (this.logToFile) {
      try {
        await fs.mkdir(this.logDir, { recursive: true });
        console.log(`📁 Directory log creata: ${this.logDir}`);
      } catch (error) {
        console.error('❌ Errore creazione directory log:', error);
      }
    }
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.currentLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const hostname = require('os').hostname();
    
    const logEntry = {
      timestamp,
      level,
      pid,
      hostname,
      message,
      ...meta
    };

    return logEntry;
  }

  async writeToFile(level, message, meta = {}) {
    if (!this.logToFile) return;

    try {
      const logEntry = this.formatMessage(level, message, meta);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `app-${date}.log`);
      
      await fs.appendFile(logFile, logLine);
      
      // Rotazione log se necessario
      await this.rotateLogIfNeeded(logFile);
    } catch (error) {
      console.error('❌ Errore scrittura log su file:', error);
    }
  }

  /**
   * Invia log ad Axiom per analisi in tempo reale
   */
  async writeToAxiom(level, message, meta = {}) {
    if (!this.logToAxiom || !this.axiomClient) return;

    try {
      const logEntry = {
        _time: new Date().toISOString(),
        level: level,
        message: message,
        log_type: meta.logType || 'application', // 'application', 'performance', 'security'
        pid: process.pid,
        hostname: require('os').hostname(),
        ...meta
      };

      // Anonimizza se richiesto (GDPR)
      if (process.env.AXIOM_ANONYMIZE === 'true') {
        // Anonimizza IP (solo rete)
        if (logEntry.ipAddress) {
          const parts = logEntry.ipAddress.split('.');
          if (parts.length === 4) {
            logEntry.ipAddress = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
          }
        }
        
        // Hash user_id se richiesto
        if (logEntry.userId && process.env.AXIOM_ANONYMIZE_USER_ID === 'true') {
          const crypto = require('crypto');
          logEntry.userId = crypto
            .createHash('sha256')
            .update(logEntry.userId + (process.env.EXPORT_HASH_SALT || 'axiom-salt'))
            .digest('hex')
            .substring(0, 16);
        }
      }

      // Invia ad Axiom (non blocca se fallisce)
      this.axiomClient.datasets.ingest(this.axiomDataset, [logEntry])
        .catch(err => {
          // Log errore silenziosamente (non bloccare applicazione)
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Errore invio log Axiom:', err.message);
          }
        });
    } catch (error) {
      // Non bloccare applicazione se Axiom fallisce
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Errore preparazione log Axiom:', error);
      }
    }
  }

  async writeToDatabase(level, message, meta = {}) {
    if (!this.logToDatabase) return;

    // Disabilita temporaneamente il logging su database per evitare errori
    console.log(`📝 LOG [${level}]: ${message}`, meta);
    return;

    try {
      const logEntry = this.formatMessage(level, message, meta);
      
      // Usa la tabella originale centralized_logs
      const query = `
        INSERT INTO centralized_logs (
          timestamp, level, pid, hostname, message, 
          user_id, ip_address, user_agent, endpoint, 
          request_id, session_id, meta_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      
      const values = [
        Math.floor(new Date(logEntry.timestamp).getTime()), // Timestamp come BIGINT
        (this.levelMapping[logEntry.level] || 'U').substring(0, 10), // Usa codice ottimizzato, max 10 caratteri
        logEntry.pid,
        (logEntry.hostname || '').substring(0, 50) || null, // Tronca hostname
        logEntry.message,
        meta.userId || null,
        meta.ipAddress ? this.compressIPAddress(meta.ipAddress) : null, // Comprimi IP
        meta.userAgent ? this.compressUserAgent(meta.userAgent) : null, // Comprimi User Agent
        meta.endpoint ? this.compressEndpoint(meta.endpoint) : null, // Comprimi Endpoint
        meta.requestId || null,
        meta.sessionId || null,
        JSON.stringify(meta),
        Math.floor(new Date().getTime()) // created_at come BIGINT
      ];
      
      await pool.query(query, values);
    } catch (error) {
      console.error('❌ Errore scrittura log su database:', error);
    }
  }

  async checkTableExists() {
    try {
      const { pool } = require('../middleware/auth');
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'centralized_logs'
        );
      `;
      const result = await pool.query(query);
      return result.rows[0].exists;
    } catch (error) {
      console.error('❌ Errore verifica tabella centralized_logs:', error);
      return false;
    }
  }


  // Funzioni di compressione per i dati
  compressIPAddress(ipAddress) {
    if (!ipAddress || ipAddress === 'unknown' || ipAddress === '') {
      return null;
    }
    
    // Gestisce formato CIDR (es. "192.168.1.1/32")
    const cleanIP = ipAddress.includes('/') ? ipAddress.split('/')[0] : ipAddress;
    
    // Skip IPv6 per ora
    if (cleanIP.includes('::')) {
      return null;
    }
    
    const parts = cleanIP.split('.');
    if (parts.length !== 4) {
      return null;
    }
    
    return (parseInt(parts[0]) << 24) + 
           (parseInt(parts[1]) << 16) + 
           (parseInt(parts[2]) << 8) + 
           parseInt(parts[3]);
  }

  compressUserAgent(userAgent) {
    if (!userAgent || userAgent === '') {
      return 'UNK';
    }
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('chrome') && ua.includes('windows')) return 'CHR-WIN';
    if (ua.includes('chrome') && ua.includes('mac')) return 'CHR-MAC';
    if (ua.includes('chrome') && ua.includes('linux')) return 'CHR-LIN';
    if (ua.includes('firefox') && ua.includes('windows')) return 'FF-WIN';
    if (ua.includes('firefox') && ua.includes('mac')) return 'FF-MAC';
    if (ua.includes('firefox') && ua.includes('linux')) return 'FF-LIN';
    if (ua.includes('safari') && ua.includes('mac')) return 'SAF-MAC';
    if (ua.includes('safari') && ua.includes('iphone')) return 'SAF-IOS';
    if (ua.includes('edge') && ua.includes('windows')) return 'EDG-WIN';
    if (ua.includes('opera') && ua.includes('windows')) return 'OPR-WIN';
    if (ua.includes('mobile') && ua.includes('chrome')) return 'MOB-CHR';
    if (ua.includes('mobile') && ua.includes('safari')) return 'MOB-SAF';
    if (ua.includes('googlebot')) return 'BOT-GGL';
    if (ua.includes('bingbot')) return 'BOT-BNG';
    
    return 'UNK';
  }

  compressEndpoint(endpoint) {
    if (!endpoint || endpoint === '') {
      return null;
    }
    
    // Compressione endpoint comuni
    if (endpoint.includes('/api/users/profile')) return '/u/p';
    if (endpoint.includes('/api/users/update')) return '/u/u';
    if (endpoint.includes('/api/opinioni/create')) return '/o/c';
    if (endpoint.includes('/api/opinioni/update')) return '/o/u';
    if (endpoint.includes('/api/comunicazioni/create')) return '/c/c';
    if (endpoint.includes('/api/voti/capo-stato')) return '/v/cs';
    if (endpoint.includes('/api/voti/iniziative-popolari')) return '/v/ip';
    if (endpoint.includes('/api/voti/ice')) return '/v/ice';
    if (endpoint.includes('/api/voti/referendum')) return '/v/r';
    if (endpoint.includes('/api/notifiche')) return '/n';
    if (endpoint.includes('/api/auth/login')) return '/a/l';
    if (endpoint.includes('/api/auth/logout')) return '/a/lo';
    if (endpoint.includes('/api/admin/users')) return '/ad/u';
    if (endpoint.includes('/api/admin/security')) return '/ad/s';
    
    // Per altri endpoint, tronca a 100 caratteri
    return endpoint.substring(0, 100);
  }

  writeToConsole(level, message, meta = {}) {
    if (!this.logToConsole) return;

    const logEntry = this.formatMessage(level, message, meta);
    const emoji = this.getLevelEmoji(level);
    const color = this.getLevelColor(level);
    
    console.log(
      `${emoji} [${logEntry.timestamp}] ${level}: ${message}`,
      meta && Object.keys(meta).length > 0 ? meta : ''
    );
  }

  getLevelEmoji(level) {
    const emojis = {
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🔍',
      TRACE: '🔎'
    };
    return emojis[level] || '📝';
  }

  getLevelColor(level) {
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[35m', // Magenta
      TRACE: '\x1b[37m'  // White
    };
    return colors[level] || '\x1b[0m';
  }

  async rotateLogIfNeeded(logFile) {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxFileSize) {
        // Ruota i file esistenti
        for (let i = this.maxFiles - 1; i > 0; i--) {
          const oldFile = `${logFile}.${i}`;
          const newFile = `${logFile}.${i + 1}`;
          
          try {
            await fs.access(oldFile);
            await fs.rename(oldFile, newFile);
          } catch (error) {
            // File non esiste, continua
          }
        }
        
        // Rinomina il file corrente
        await fs.rename(logFile, `${logFile}.1`);
        console.log(`🔄 Log ruotato: ${logFile}`);
      }
    } catch (error) {
      console.error('❌ Errore rotazione log:', error);
    }
  }

  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    // Scrittura asincrona su tutti i canali
    const promises = [
      this.writeToFile(level, message, meta),
      this.writeToDatabase(level, message, meta)
    ];
    
    // Axiom (non blocca se fallisce)
    this.writeToAxiom(level, message, meta);
    
    // Console sempre sincrona per debugging
    this.writeToConsole(level, message, meta);
    
    // Esegui scritture asincrone in parallelo
    await Promise.allSettled(promises);
  }

  // Metodi di convenienza
  async error(message, meta = {}) {
    await this.log('ERROR', message, meta);
  }

  async warn(message, meta = {}) {
    await this.log('WARN', message, meta);
  }

  async info(message, meta = {}) {
    await this.log('INFO', message, meta);
  }

  async debug(message, meta = {}) {
    await this.log('DEBUG', message, meta);
  }

  async trace(message, meta = {}) {
    await this.log('TRACE', message, meta);
  }

  // Logging specifico per richieste HTTP
  async logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || null,
      sessionId: req.sessionID || null,
      requestId: req.id || null
    };

    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    const message = `${req.method} ${req.originalUrl} - ${res.statusCode}`;
    
    await this.log(level, message, meta);
  }

  // Logging per errori
  async logError(error, req = null, meta = {}) {
    const errorMeta = {
      ...meta,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    };

    if (req) {
      errorMeta.method = req.method;
      errorMeta.url = req.originalUrl;
      errorMeta.ipAddress = req.ip;
      errorMeta.userAgent = req.get('User-Agent');
      errorMeta.userId = req.user?.id || null;
    }

    await this.error(`Errore: ${error.message}`, errorMeta);
  }

  // Logging per eventi di sicurezza
  async logSecurity(event, details = {}) {
    const meta = {
      ...details,
      securityEvent: true,
      timestamp: new Date().toISOString()
    };

    await this.warn(`Evento di sicurezza: ${event}`, meta);
  }

  // Logging per performance
  async logPerformance(operation, duration, details = {}) {
    const meta = {
      ...details,
      operation,
      duration: `${duration}ms`,
      performanceEvent: true
    };

    const level = duration > 1000 ? 'WARN' : 'INFO';
    await this.log(level, `Performance: ${operation} completato in ${duration}ms`, meta);
  }

  // Logging per audit
  async logAudit(action, resource, userId, details = {}) {
    const meta = {
      ...details,
      action,
      resource,
      userId,
      auditEvent: true
    };

    await this.info(`Audit: ${action} su ${resource}`, meta);
  }

  // Statistiche log
  async getLogStats(days = 7) {
    try {
      // Usa la vista decompressa per leggere i dati
      const query = `
        SELECT 
          level,
          COUNT(*) as count,
          DATE(timestamp) as date
        FROM centralized_logs_decompressed 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY level, DATE(timestamp)
        ORDER BY date DESC, level
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore recupero statistiche log:', error);
      return [];
    }
  }

  // Pulizia log vecchi
  async cleanupOldLogs(retentionDays = 30) {
    try {
      const query = `
        DELETE FROM centralized_logs 
        WHERE timestamp < (EXTRACT(EPOCH FROM NOW() - INTERVAL '${retentionDays} days') * 1000)::BIGINT
      `;
      
      const result = await pool.query(query);
      console.log(`🧹 Puliti ${result.rowCount} log vecchi (${retentionDays} giorni)`);
      
      return result.rowCount;
    } catch (error) {
      console.error('❌ Errore pulizia log:', error);
      return 0;
    }
  }

  // Esporta log per analisi
  async exportLogs(startDate, endDate, level = null) {
    try {
      let query = `
        SELECT * FROM centralized_logs_decompressed 
        WHERE timestamp BETWEEN $1 AND $2
      `;
      const params = [startDate, endDate];
      
      if (level) {
        query += ' AND level = $3';
        params.push(level);
      }
      
      query += ' ORDER BY timestamp DESC';
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore esportazione log:', error);
      return [];
    }
  }

  // Funzioni helper per conversione codici
  encodeLevel(fullName) {
    return this.levelMapping[fullName] || 'U';
  }

  decodeLevel(code) {
    return this.reverseMapping[code] || 'UNKNOWN';
  }

  // Funzione per ottenere tutti i mapping
  getLevelMappings() {
    return {
      forward: this.levelMapping,
      reverse: this.reverseMapping
    };
  }
}

// Istanza singleton
const logger = new CentralizedLogger();

module.exports = logger;
