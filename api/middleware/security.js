// File: api/middleware/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Configurazione Helmet per sicurezza headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.demos.community"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

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

module.exports = {
  helmetConfig,
  securityLimiter,
  securityMiddleware,
  securityLogger
};
