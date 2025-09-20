// File: api/middleware/security.js
const rateLimit = require('express-rate-limit');

// Middleware per headers di sicurezza (sostituisce Helmet)
const securityHeaders = (req, res, next) => {
  // Non applicare CSP alle richieste API
  if (!req.path.startsWith('/api/')) {
    // Content Security Policy
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "script-src 'self'; " +
      "connect-src 'self' https://api.demos.community https://demos-c7k0.onrender.com; " +
      "frame-src 'none'; " +
      "object-src 'none'; " +
      "upgrade-insecure-requests"
    );
  }
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Strict-Transport-Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // X-Permitted-Cross-Domain-Policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Permissions-Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Rate limiting per sicurezza
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 50, // Limite più basso per sicurezza
  message: {
    success: false,
    error: 'Troppe richieste di sicurezza',
    message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚨 SECURITY RATE LIMIT: IP ${req.ip} ha superato il limite di sicurezza`);
    res.status(429).json({
      success: false,
      error: 'Troppe richieste di sicurezza',
      message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

// Middleware per prevenire attacchi comuni
const securityMiddleware = (req, res, next) => {
  // Prevenire SQL Injection nei parametri
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

  // Controlla body, query e params
  const checkForSQLInjection = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        for (const pattern of sqlInjectionPatterns) {
          if (pattern.test(value)) {
            console.log(`🚨 SQL INJECTION ATTEMPT: ${path}${key} = ${value}`);
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

  // Controlla body
  if (req.body && typeof req.body === 'object') {
    const bodyCheck = checkForSQLInjection(req.body, 'body.');
    if (bodyCheck) return bodyCheck;
  }

  // Controlla query
  if (req.query && typeof req.query === 'object') {
    const queryCheck = checkForSQLInjection(req.query, 'query.');
    if (queryCheck) return queryCheck;
  }

  // Controlla params
  if (req.params && typeof req.params === 'object') {
    const paramsCheck = checkForSQLInjection(req.params, 'params.');
    if (paramsCheck) return paramsCheck;
  }

  // Prevenire XSS nei parametri
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*>.*?<\/link>/gi,
    /<meta[^>]*>.*?<\/meta>/gi,
    /<style[^>]*>.*?<\/style>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi
  ];

  const checkForXSS = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        for (const pattern of xssPatterns) {
          if (pattern.test(value)) {
            console.log(`🚨 XSS ATTEMPT: ${path}${key} = ${value}`);
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

  // Controlla body per XSS
  if (req.body && typeof req.body === 'object') {
    const bodyCheck = checkForXSS(req.body, 'body.');
    if (bodyCheck) return bodyCheck;
  }

  // Controlla query per XSS
  if (req.query && typeof req.query === 'object') {
    const queryCheck = checkForXSS(req.query, 'query.');
    if (queryCheck) return queryCheck;
  }

  // Controlla params per XSS
  if (req.params && typeof req.params === 'object') {
    const paramsCheck = checkForXSS(req.params, 'params.');
    if (paramsCheck) return paramsCheck;
  }

  // Prevenire attacchi di path traversal
  const pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
    /\.\.%252f/gi,
    /\.\.%255c/gi
  ];

  const checkForPathTraversal = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        for (const pattern of pathTraversalPatterns) {
          if (pattern.test(value)) {
            console.log(`🚨 PATH TRAVERSAL ATTEMPT: ${path}${key} = ${value}`);
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

  // Controlla body per path traversal
  if (req.body && typeof req.body === 'object') {
    const bodyCheck = checkForPathTraversal(req.body, 'body.');
    if (bodyCheck) return bodyCheck;
  }

  // Controlla query per path traversal
  if (req.query && typeof req.query === 'object') {
    const queryCheck = checkForPathTraversal(req.query, 'query.');
    if (queryCheck) return queryCheck;
  }

  // Controlla params per path traversal
  if (req.params && typeof req.params === 'object') {
    const paramsCheck = checkForPathTraversal(req.params, 'params.');
    if (paramsCheck) return paramsCheck;
  }

  // Limita dimensione richiesta
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    console.log(`🚨 REQUEST TOO LARGE: ${contentLength} bytes from ${req.ip}`);
    return res.status(413).json({
      success: false,
      error: 'Richiesta troppo grande',
      message: 'La richiesta supera la dimensione massima consentita'
    });
  }

  // Controlla User-Agent sospetti
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
      console.log(`🚨 SUSPICIOUS USER AGENT: ${userAgent} from ${req.ip}`);
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'User-Agent non consentito'
      });
    }
  }

  // Aggiungi timestamp per tracking
  req.securityTimestamp = new Date().toISOString();
  
  next();
};

// Middleware per logging sicurezza
const securityLogger = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log richieste sospette
    if (res.statusCode >= 400) {
      console.log(`🚨 SECURITY ALERT: ${req.method} ${req.originalUrl} - ${res.statusCode} - IP: ${req.ip} - UA: ${req.get('User-Agent')}`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Middleware per validazione input
const validateInput = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].toString().trim() === '') {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Campi richiesti mancanti',
        message: `I seguenti campi sono obbligatori: ${missingFields.join(', ')}`,
        missingFields
      });
    }
    
    next();
  };
};

// Middleware per sanitizzazione input
const sanitizeInput = (fieldsToSanitize = []) => {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      for (const field of fieldsToSanitize) {
        if (req.body[field] && typeof req.body[field] === 'string') {
          // Rimuovi caratteri pericolosi
          req.body[field] = req.body[field]
            .replace(/[<>]/g, '') // Rimuovi < e >
            .replace(/javascript:/gi, '') // Rimuovi javascript:
            .replace(/on\w+\s*=/gi, '') // Rimuovi event handlers
            .trim(); // Rimuovi spazi iniziali/finali
        }
      }
    }
    
    next();
  };
};

module.exports = {
  securityHeaders,
  securityLimiter,
  securityMiddleware,
  securityLogger,
  validateInput,
  sanitizeInput
};
