// File: api/services/centralizedLogger.js
const { pool } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');
const { sanitizeLogMeta, minimizeOperationalPath, safeDiagnosticCode } = require('../utils/logPrivacy');
const { normalizeLevel, shouldWriteLogEvent } = require('../utils/logEventPolicy');
const { createFailureReporter } = require('../utils/logDeliveryFailureReporter');
const reportAxiomIngestFailure = createFailureReporter();

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
    
    this.currentLevel = normalizeLevel(process.env.LOG_LEVEL);
    this.logToFile = process.env.LOG_TO_FILE === 'true';
    this.logToDatabase = process.env.LOG_TO_DATABASE !== 'false';
    this.logToConsole = process.env.LOG_TO_CONSOLE !== 'false';
    // Abilita Axiom se configurato (non dipende dall'SDK, usa HTTP diretto)
    this.logToAxiom = process.env.AXIOM_ENABLED === 'true' 
      && process.env.AXIOM_API_TOKEN 
      && process.env.AXIOM_ORG_ID;
    
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

  shouldLog(level, meta = {}) {
    return shouldWriteLogEvent(level, this.currentLevel, meta);
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
    if (!this.logToAxiom || process.env.AXIOM_ENABLED !== 'true') return;
    if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) return;

    try {
      // I log operativi ordinari sono deliberatamente non identificanti.
      // Solo eventi audit/security espliciti possono includere identificatori diretti,
      // perché hanno finalità e retention distinte.
      const isAuditOrSecurity = meta.auditEvent === true || meta.securityEvent === true;
      const logEntry = {
        _time: new Date().toISOString(),
        message: message || '',
        endpoint: meta.endpoint || null
      };

      if (isAuditOrSecurity) {
        // The archive uses this explicit category for independent retention policies.
        logEntry.log_type = meta.securityEvent === true ? 'security' : 'audit';
        logEntry.user_id = meta.userId || null;
        logEntry.ip_address = meta.ipAddress || null;
        logEntry.session_id = meta.sessionId || null;
      }
      
      // Debug: log del payload inviato (solo in development)
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_AXIOM_LOGS === 'true') {
        console.log('📤 Log inviato ad Axiom:', JSON.stringify(logEntry, null, 2));
      }
      
      // NOTA: Campi rimossi (non obbligatori per GDPR):
      // - level: non obbligatorio (utile per debugging ma non GDPR-required)
      // - log_type: non obbligatorio (categorizzazione non GDPR-required)
      // - user_agent: non obbligatorio (utile per sicurezza ma non GDPR-required)
      // - request_id: non obbligatorio (tracciamento tecnico non GDPR-required)
      // - pid, hostname: già rimossi in precedenza
      
      // Aggiungi solo campi specifici da meta se necessari (non tutto l'oggetto)
      // Evita di inviare dati non necessari che aumentano la dimensione

      // Anonimizza se richiesto (GDPR)
      if (process.env.AXIOM_ANONYMIZE === 'true') {
        // Anonimizza IP (solo rete) - usa ip_address (con underscore)
        if (logEntry.ip_address) {
          const parts = logEntry.ip_address.split('.');
          if (parts.length === 4) {
            logEntry.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
          }
        }
        
        // Hash user_id se richiesto - usa user_id (con underscore)
        if (logEntry.user_id && process.env.AXIOM_ANONYMIZE_USER_ID === 'true') {
          const crypto = require('crypto');
          logEntry.user_id = crypto
            .createHash('sha256')
            .update(logEntry.user_id + (process.env.EXPORT_HASH_SALT || 'axiom-salt'))
            .digest('hex')
            .substring(0, 16);
        }
      }

      // Usa HTTP diretto invece dell'SDK per evitare problemi di regione
      await this.sendToAxiomHTTP(this.axiomDataset, [logEntry]);
    } catch (error) {
      // Non interrompere le richieste utente; lascia una segnalazione operativa senza dati personali.
      reportAxiomIngestFailure(error?.response?.status);
    }
  }

  async sendToAxiomHTTP(dataset, events) {
    const axios = require('axios');
    
    const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
    const edgeDomain = process.env.AXIOM_EDGE_DOMAIN 
      || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
    const url = `https://${edgeDomain}/v1/ingest/${dataset}`;
    
    const token = process.env.AXIOM_API_TOKEN;
    const orgId = process.env.AXIOM_ORG_ID;
    
    if (!token || !orgId) return;
    
    try {
      await axios.post(url, events, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': orgId
        },
        timeout: 5000, // Timeout breve per non bloccare
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
    } catch (error) {
      // Errori di rete/HTTP visibili in produzione, ma senza token, eventi o URL sensibili.
      reportAxiomIngestFailure(error?.response?.status);
    }
  }

  async writeToDatabase(level, message, meta = {}) {
    // DISABILITATO: I log vengono salvati solo su Axiom, non più su PostgreSQL
    // Questo per alleggerire il database e centralizzare i log su Axiom
    if (process.env.AXIOM_ENABLED === 'true') {
      // Se Axiom è abilitato, non salvare su PostgreSQL
      return;
    }
    
    // Solo se Axiom non è abilitato, salva su PostgreSQL (fallback) — solo se la tabella esiste ancora
    if (!this.logToDatabase) return;

    try {
      const { isCentralizedLogsTableAvailable } = require('../utils/centralizedLogsDb');
      if (!(await isCentralizedLogsTableAvailable())) {
        // Log migrati su Axiom: tabella centralized_logs rimossa — niente fallback DB
        return;
      }

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
      // 42P01 = tabella assente (es. dopo migrazione ad Axiom)
      if (error && error.code === '42P01') {
        return;
      }
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
    if (!this.shouldLog(level, meta)) return;

    // Per default i log operativi non devono contenere identificatori diretti.
    // Audit e security events sono canali espliciti separati.
    const safeMeta = sanitizeLogMeta(meta);

    const promises = [
      this.writeToFile(level, message, safeMeta),
      this.writeToDatabase(level, message, safeMeta),
      this.writeToAxiom(level, message, safeMeta).catch(() => {})
    ];
    
    this.writeToConsole(level, message, safeMeta);
    
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

  /**
   * Endpoint che possono rivelare opinioni, voti, sostegni o altre scelte politiche.
   * Per questi endpoint i log operativi non devono collegare l'azione a un utente/IP/sessione.
   */
  isSensitiveActivityEndpoint(url) {
    const sensitivePrefixes = [
      '/api/opinioni',
      '/api/referendum-abrogativi',
      '/api/referendum',
      '/api/iniziative-popolari',
      '/api/ice',
      '/api/eci',
      '/api/capo-stato',
      '/api/governo/consenso',
      '/api/governo/ministro',
      '/api/grazia',
      '/api/amnistia',
      '/api/sostenitori',
      '/api/rappresentanti',
      '/api/candidati/sostenitori',
      '/api/attivisti/sostenitori',
      '/api/organizzazioni/sostenitori',
      '/api/elezioni-utente'
    ];

    return sensitivePrefixes.some(prefix => url.startsWith(prefix));
  }

  /**
   * Policy interna di logging orientata ad accountability e sicurezza.
   * Il GDPR non impone di registrare ogni richiesta né di conservare identificativi nei log:
   * si applicano minimizzazione e proporzionalità.
   */
  shouldLogForGDPR(url, method, statusCode) {
    // Conserva segnali tecnici sugli errori, non perché ogni log sia imposto dal GDPR.
    if (statusCode >= 400) {
      return true;
    }

    // Endpoint a bassa necessità diagnostica, quando il filtro opzionale è attivo.
    // Include le GET del menu (prossimo evento, prossima iniziativa, prossimo referendum)
    // per evitare accumulo di log su ogni visita alla pagina menu
    const publicEndpoints = [
      '/api/health',
      '/api/ministero/iniziative',
      '/api/ministero/iniziative/',
      '/api/governo/ministri',
      '/api/governo/ministri/',
      '/api/statistiche',
      '/api/statistiche/',
      '/api/services',
      '/api/compatibility',
      '/api/eventi/prossimo',              // menu: prossimo evento (dati non personali)
      '/api/iniziative-popolari/prossima', // menu: prossima iniziativa (dati non personali)
      '/api/referendum-abrogativi/prossima' // menu: prossimo referendum (dati non personali)
    ];

    // Verifica se è un endpoint pubblico
    for (const endpoint of publicEndpoints) {
      if (url.startsWith(endpoint)) {
        return false; // Non necessario per GDPR
      }
    }

    // Endpoint sensibili per cui può essere utile un evento tecnico minimizzato; nessun obbligo GDPR generalizzato.
    const gdprRequiredEndpoints = [
      '/api/users',           // Dati utenti
      '/api/auth',            // Autenticazione (dati personali)
      '/api/opinioni',        // Opinion personali
      '/api/voti',            // Voti personali
      '/api/comunicazioni',   // Comunicazioni personali
      '/api/notifiche',       // Notifiche personali
      '/api/segnalazioni',    // Segnalazioni (possono contenere dati personali)
      '/api/admin',           // Admin (accesso a dati personali)
      '/api/user/',           // Profilo utente
      '/api/gdpr',            // Richieste GDPR
      '/api/download-data',   // Download dati personali
      '/api/delete-account'   // Cancellazione account
    ];

    // Verifica categorie selezionate dalla policy applicativa attuale, ancora da sottoporre al DPO.
    for (const endpoint of gdprRequiredEndpoints) {
      if (url.startsWith(endpoint)) {
        return true; // Selezione tecnica prudenziale, NON requisito legale generale.
      }
    }

    // Metodi mutativi: preferenza tecnica per eventi minimizzati, non obbligo normativo generale.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true; // Modifiche ai dati potrebbero riguardare dati personali
    }

    // Default legacy ampio, da valutare con DPO per un eventuale restringimento.
    // Non abilitare ulteriori raccolte basandosi soltanto su questo flag.
    return process.env.GDPR_LOGGING_STRICT === 'true' ? false : true;
  }

  // Logging specifico per richieste HTTP
  async logRequest(req, res, responseTime) {
    const originalPath = String(req.originalUrl || '').split(/[?#]/, 1)[0];
    const url = minimizeOperationalPath(originalPath);
    const method = req.method;
    const statusCode = res.statusCode;

    // Filtra per GDPR se abilitato
    if (process.env.GDPR_LOGGING_FILTER === 'true') {
      if (!this.shouldLogForGDPR(originalPath, method, statusCode)) {
        // Non loggare su Axiom (ma puoi ancora loggare su console/file per debugging)
        if (this.logToAxiom) {
          return; // Skip logging to Axiom
        }
      }
    }

    // I request log operativi non generano né conservano session identifier.
    const sensitiveActivity = this.isSensitiveActivityEndpoint(originalPath);

    const meta = {
      method: req.method,
      url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      requestId: req.id || null,
      endpoint: url,
      sensitiveActivity
    };

    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    const message = `${req.method} ${url} - ${res.statusCode}`;
    
    await this.log(level, message, meta);
  }

  // Logging per errori
  async logError(error, req = null, meta = {}) {
    const errorMeta = {
      ...meta,
      // Only controlled diagnostic codes, not free text/stack in durable logs.
      error: { code: safeDiagnosticCode(error?.code) }
    };

    if (req) {
      const originalPath = String(req.originalUrl || '').split(/[?#]/, 1)[0];
      const endpoint = minimizeOperationalPath(originalPath);
      const sensitiveActivity = this.isSensitiveActivityEndpoint(originalPath);

      errorMeta.method = req.method;
      errorMeta.url = endpoint;
      errorMeta.sensitiveActivity = sensitiveActivity;
    }

    await this.error(`Errore applicativo: ${safeDiagnosticCode(error?.code)}`, errorMeta);

    // Gli errori non gestiti dal middleware globale devono generare un alert operativo reale.
    // Il dettaglio completo resta nei log; la notifica Admin contiene solo metadati minimali.
    if (meta.globalError === true || meta.operationalCritical === true) {
      try {
        const OperationalAlertService = require('./operationalAlertService');
        // Un URIError dovuto a una URL malformata è una richiesta client errata,
        // non un incidente del server. Controllare il percorso prima di minimizzarlo.
        let malformedClientUri = false;
        if (req && String(error?.code || error?.name || '').toLowerCase() === 'urierror') {
          try {
            decodeURI(String(req.originalUrl || '').split(/[?#]/, 1)[0]);
          } catch {
            malformedClientUri = true;
          }
        }
        await OperationalAlertService.sendCriticalAlert({
          type: 'UNHANDLED_API_ERROR',
          malformedClientUri,
          component: 'api',
          severity: 'CRITICAL',
          endpoint: errorMeta.url || meta.endpoint || '',
          code: error.code || error.name || ''
        });
      } catch (alertError) {
        console.error('Operational alert failed:', alertError.message);
      }
    }
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
      // Se Axiom è abilitato, leggi da Axiom invece di Neon
      if (process.env.AXIOM_ENABLED === 'true') {
        const { getCentralizedLogs } = require('../utils/axiomQueryHelper');
        
        const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const endTime = new Date();
        
        const logs = await getCentralizedLogs({
          startTime,
          endTime,
          limit: 100000 // Limite alto per statistiche
        });
        
        // Calcola statistiche per livello e data
        const statsByLevelAndDate = {};
        logs.forEach(log => {
          const date = new Date(log._time || Date.now()).toISOString().split('T')[0];
          const level = log.level || 'UNKNOWN';
          const key = `${date}-${level}`;
          
          if (!statsByLevelAndDate[key]) {
            statsByLevelAndDate[key] = {
              level,
              count: 0,
              date
            };
          }
          statsByLevelAndDate[key].count++;
        });
        
        return Object.values(statsByLevelAndDate).sort((a, b) => {
          if (a.date !== b.date) {
            return b.date.localeCompare(a.date);
          }
          return a.level.localeCompare(b.level);
        });
      }
      
      // Fallback a Neon se Axiom non è abilitato
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

  // RP-10 not approved: direct callers cannot claim a fictitious cleanup.
  async cleanupOldLogs(_retentionDays = 30) {
    const error = new Error('LOG_RETENTION_POLICY_NOT_APPROVED');
    error.code = 'LOG_RETENTION_POLICY_NOT_APPROVED';
    error.statusCode = 409;
    throw error;
  }

  // Esporta log per analisi
  async exportLogs(startDate, endDate, level = null) {
    try {
      // Se Axiom è abilitato, leggi da Axiom invece di Neon
      if (process.env.AXIOM_ENABLED === 'true') {
        const { getCentralizedLogs } = require('../utils/axiomQueryHelper');
        
        const logs = await getCentralizedLogs({
          level: level || null,
          startTime: new Date(startDate),
          endTime: new Date(endDate),
          limit: 100000 // Limite alto per esportazione
        });
        
        // Formatta per compatibilità con formato precedente
        return logs.map(log => ({
          timestamp: log._time || new Date().toISOString(),
          level: log.level || 'UNKNOWN',
          message: log.message || '',
          user_id: log.user_id || null,
          ip_address: log.ip_address || null,
          endpoint: log.endpoint || null
        }));
      }
      
      // Fallback a Neon se Axiom non è abilitato
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
