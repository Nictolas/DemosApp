// File: api/middleware/security.js
const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';
const REDACTED = '[REDACTED]';
const CONSOLE_REDACTION_FLAG = Symbol.for('demos.productionConsoleRedactionInstalled');
const SENSITIVE_LOG_KEY = /(?:authorization|cookie|token|secret|password|credential|api[_-]?key|session|jti|sid|email|given_name|family_name|provider_sub|\bsub\b|user[_-]?id)/i;

const debugLog = (...args) => {
  if (!isProduction) console.log(...args);
};

function redactStringForLogs(value) {
  return String(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/=:-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED);
}

function redactForLogs(value, depth = 0, seen = new WeakSet()) {
  if (typeof value === 'string') return redactStringForLogs(value);
  if (value == null || typeof value !== 'object') return value;
  if (depth > 6) return '[REDACTED:MAX_DEPTH]';
  if (seen.has(value)) return '[REDACTED:CIRCULAR]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactStringForLogs(value.message || ''),
      ...(isProduction ? {} : { stack: value.stack })
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForLogs(item, depth + 1, seen));
  }

  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    clean[key] = SENSITIVE_LOG_KEY.test(key)
      ? REDACTED
      : redactForLogs(item, depth + 1, seen);
  }
  return clean;
}

function installProductionConsoleRedaction() {
  if (!isProduction || globalThis[CONSOLE_REDACTION_FLAG]) return;
  globalThis[CONSOLE_REDACTION_FLAG] = true;

  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    if (typeof console[method] !== 'function') continue;
    const original = console[method].bind(console);
    console[method] = (...args) => original(...args.map((arg) => redactForLogs(arg)));
  }
}

installProductionConsoleRedaction();

function sanitizeProduction5xxBody(body) {
  if (!isProduction) return body;

  const requestId = body && typeof body === 'object' && !Array.isArray(body)
    ? body.requestId
    : undefined;

  return {
    success: false,
    error: 'Errore interno del server',
    ...(requestId ? { requestId } : {})
  };
}

function installProductionResponseSanitizer(res) {
  if (!isProduction || !res || typeof res.json !== 'function' || res.__demos5xxSanitizerInstalled) return;

  const originalJson = res.json.bind(res);
  res.__demos5xxSanitizerInstalled = true;
  res.json = function jsonWithProductionErrorSanitization(body) {
    if (Number(this.statusCode) >= 500) {
      return originalJson(sanitizeProduction5xxBody(body));
    }
    return originalJson(body);
  };
}

function requestPath(req) {
  return String(req?.originalUrl || req?.url || '');
}

function isAppApiPath(req) {
  return /^\/api(?:\/|\?|$)/.test(requestPath(req));
}

function isAuthApiPath(req) {
  return /^\/api\/auth(?:\/|\?|$)/.test(requestPath(req));
}

function enforceCanonicalBearerToken(req, res) {
  // Internal validation surfaces can have their own isolated Bearer contracts.
  // The DEMOS access-token contract applies only to the public application API.
  if (!isAppApiPath(req) || isAuthApiPath(req)) return null;

  const header = String(req?.headers?.authorization || '');
  if (!header.startsWith('Bearer ')) return null;

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token non valido' });
  }

  try {
    // Lazy import: auth routes use special short-lived tokens during registration and are exempt above.
    const { verifyAccessToken } = require('../utils/jwt');
    verifyAccessToken(token);
    return null;
  } catch (_error) {
    return res.status(401).json({
      success: false,
      error: 'Token non valido',
      message: 'Effettua nuovamente il login'
    });
  }
}

// Middleware per headers di sicurezza (sostituisce Helmet)
const securityHeaders = (req, res, next) => {
  // Non applicare CSP alle richieste API. Il CSP del frontend è gestito dal deploy.
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
};

// Rate limiting per sicurezza
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: 'Troppe richieste di sicurezza',
    message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn('SECURITY_RATE_LIMIT_REJECTED');
    res.status(429).json({
      success: false,
      error: 'Troppe richieste di sicurezza',
      message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

// Middleware per prevenire attacchi comuni e applicare guardrail di produzione.
const securityMiddleware = (req, res, next) => {
  installProductionResponseSanitizer(res);

  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
    /(\b(OR|AND)\s+1\s*=\s*1)/i,
    /(\b(OR|AND)\s+0\s*=\s*0)/i,
    /(\b(OR|AND)\s+true)/i,
    /(\b(OR|AND)\s+false)/i,
    /(UNION\s+SELECT)/i,
    /(DROP\s+TABLE)/i,
    /(DELETE\s+FROM)/i,
    /(INSERT\s+INTO)/i,
    /(UPDATE\s+SET)/i
  ];

  const checkForSQLInjection = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        for (const pattern of sqlInjectionPatterns) {
          if (pattern.test(value)) {
            console.warn('SECURITY_INPUT_SQL_REJECTED');
            return res.status(400).json({
              success: false,
              error: 'Input non valido',
              message: 'Rilevato tentativo di attacco SQL injection'
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = checkForSQLInjection(value, `${path}${key}.`);
        if (result) return result;
      }
    }
    return null;
  };

  if (req.body && typeof req.body === 'object') {
    const bodyCheck = checkForSQLInjection(req.body, 'body.');
    if (bodyCheck) return bodyCheck;
  }

  if (req.query && typeof req.query === 'object') {
    const queryCheck = checkForSQLInjection(req.query, 'query.');
    if (queryCheck) return queryCheck;
  }

  if (req.params && typeof req.params === 'object') {
    const paramsCheck = checkForSQLInjection(req.params, 'params.');
    if (paramsCheck) return paramsCheck;
  }

  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/i,
    /<iframe[^>]*>.*?<\/iframe>/i,
    /<object[^>]*>.*?<\/object>/i,
    /<embed[^>]*>.*?<\/embed>/i,
    /<link[^>]*>.*?<\/link>/i,
    /<meta[^>]*>.*?<\/meta>/i,
    /<style[^>]*>.*?<\/style>/i,
    /javascript:/i,
    /vbscript:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    /onmouseover\s*=/i
  ];

  const checkForXSS = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        for (const pattern of xssPatterns) {
          if (pattern.test(value)) {
            console.warn('SECURITY_INPUT_XSS_REJECTED');
            return res.status(400).json({
              success: false,
              error: 'Input non valido',
              message: 'Rilevato tentativo di attacco XSS'
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = checkForXSS(value, `${path}${key}.`);
        if (result) return result;
      }
    }
    return null;
  };

  if (req.body && typeof req.body === 'object') {
    const bodyCheck = checkForXSS(req.body, 'body.');
    if (bodyCheck) return bodyCheck;
  }

  if (req.query && typeof req.query === 'object') {
    const queryCheck = checkForXSS(req.query, 'query.');
    if (queryCheck) return queryCheck;
  }

  if (req.params && typeof req.params === 'object') {
    const paramsCheck = checkForXSS(req.params, 'params.');
    if (paramsCheck) return paramsCheck;
  }

  const pathTraversalPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /\.\.%2f/i,
    /\.\.%5c/i,
    /\.\.%252f/i,
    /\.\.%255c/i
  ];

  const checkForPathTraversal = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        for (const pattern of pathTraversalPatterns) {
          if (pattern.test(value)) {
            console.warn('SECURITY_INPUT_PATH_REJECTED');
            return res.status(400).json({
              success: false,
              error: 'Input non valido',
              message: 'Rilevato tentativo di attacco path traversal'
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        const result = checkForPathTraversal(value, `${path}${key}.`);
        if (result) return result;
      }
    }
    return null;
  };

  if (req.body && typeof req.body === 'object') {
    const bodyCheck = checkForPathTraversal(req.body, 'body.');
    if (bodyCheck) return bodyCheck;
  }

  if (req.query && typeof req.query === 'object') {
    const queryCheck = checkForPathTraversal(req.query, 'query.');
    if (queryCheck) return queryCheck;
  }

  if (req.params && typeof req.params === 'object') {
    const paramsCheck = checkForPathTraversal(req.params, 'params.');
    if (paramsCheck) return paramsCheck;
  }

  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const maxSize = 10 * 1024 * 1024;

  if (contentLength > maxSize) {
    console.warn('SECURITY_REQUEST_SIZE_REJECTED');
    return res.status(413).json({
      success: false,
      error: 'Richiesta troppo grande',
      message: 'La richiesta supera la dimensione massima consentita'
    });
  }

  const userAgent = req.get('User-Agent') || '';
  const suspiciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zap/i,
    /burp/i,
    /w3af/i,
    /havij/i,
    /acunetix/i,
    /nessus/i,
    /openvas/i,
    /metasploit/i,
    /cobalt/i,
    /beef/i,
    /xsser/i
  ];

  for (const pattern of suspiciousUserAgents) {
    if (pattern.test(userAgent)) {
      console.warn('SECURITY_USER_AGENT_REJECTED');
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'User-Agent non consentito'
      });
    }
  }

  // Preserve deterministic attack-filter precedence, then enforce the canonical
  // access-token contract before any downstream application route can execute.
  const bearerRejection = enforceCanonicalBearerToken(req, res);
  if (bearerRejection) return bearerRejection;

  req.securityTimestamp = new Date().toISOString();
  next();
};

// Middleware per logging sicurezza
const securityLogger = (req, res, next) => {
  const originalSend = res.send;

  res.send = function(data) {
    if (res.statusCode >= 400) {
      console.warn('SECURITY_HTTP_REJECTED', res.statusCode);
    }

    return originalSend.call(this, data);
  };

  next();
};

// Middleware per validazione input
const validateInput = (requiredFields) => {
  return (req, res, next) => {
    try {
      debugLog(`🔍 VALIDATE INPUT: Controllo campi ${requiredFields.join(', ')}`);
      debugLog('📦 REQ BODY:', req.body);

      if (!requiredFields || requiredFields.length === 0) {
        debugLog('✅ VALIDATION SKIPPED: Nessun campo richiesto');
        return next();
      }

      const missingFields = [];

      for (const field of requiredFields) {
        if (!req.body[field] || req.body[field].toString().trim() === '') {
          missingFields.push(field);
          debugLog(`❌ Campo mancante: ${field}`);
        } else {
          debugLog(`✅ Campo presente: ${field}`);
        }
      }

      if (missingFields.length > 0) {
        debugLog(`🚫 VALIDATION FAILED: Campi mancanti: ${missingFields.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'Campi richiesti mancanti',
          message: `I seguenti campi sono obbligatori: ${missingFields.join(', ')}`,
          missingFields
        });
      }

      debugLog('✅ VALIDATION PASSED: Tutti i campi presenti');
      next();
    } catch (error) {
      console.error('❌ Errore nel middleware validateInput:', error);
      next(error);
    }
  };
};

// Middleware per sanitizzazione input
const sanitizeInput = (fieldsToSanitize = []) => {
  return (req, res, next) => {
    try {
      debugLog(`🧹 SANITIZE INPUT: Campi da sanitizzare ${fieldsToSanitize.join(', ')}`);
      debugLog('📦 REQ BODY PRIMA:', req.body);

      if (!fieldsToSanitize || fieldsToSanitize.length === 0) {
        debugLog('✅ SANITIZE SKIPPED: Nessun campo da sanitizzare');
        return next();
      }

      if (req.body && typeof req.body === 'object') {
        for (const field of fieldsToSanitize) {
          if (req.body[field] && typeof req.body[field] === 'string') {
            const originalValue = req.body[field];
            req.body[field] = req.body[field]
              .replace(/[<>]/g, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .trim();

            if (originalValue !== req.body[field]) {
              debugLog(`🧹 Campo ${field} sanitizzato`);
            }
          }
        }
      }

      debugLog('📦 REQ BODY DOPO:', req.body);
      debugLog('✅ SANITIZE COMPLETED');
      next();
    } catch (error) {
      console.error('❌ Errore nel middleware sanitizeInput:', error);
      next(error);
    }
  };
};

module.exports = {
  securityHeaders,
  securityLimiter,
  securityMiddleware,
  securityLogger,
  validateInput,
  sanitizeInput,
  // Exported for deterministic regression tests only.
  _test: {
    redactForLogs,
    sanitizeProduction5xxBody,
    enforceCanonicalBearerToken
  }
};
