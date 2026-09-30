// File: api/middleware/loggingMiddleware.js
const logger = require('../services/centralizedLogger');
const requestMetrics = require('../services/requestMetrics');
const crypto = require('crypto');
const { verifyAccessToken } = require('../utils/jwt');
const { isAccessSessionRevoked } = require('../services/accessRevocationService');

// Middleware per logging richieste HTTP.
// È montato globalmente prima delle route: qui applichiamo anche il gate di revoca
// distribuita degli access token per coprire sia verifyToken sia le route legacy/manuali.
const requestLoggingMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Aggiungi ID richiesta al request
  req.id = requestId;
  
  // Override del metodo end per catturare il tempo di risposta
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;

    try {
      requestMetrics.record(req, res, responseTime);
    } catch (e) {
      console.error('❌ Errore requestMetrics.record:', e);
    }
    
    // Log della richiesta
    logger.logRequest(req, res, responseTime).catch(error => {
      console.error('❌ Errore logging richiesta:', error);
    });
    
    // Chiama il metodo end originale
    originalEnd.call(this, chunk, encoding);
  };

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    let decodedAccess = null;

    try {
      decodedAccess = verifyAccessToken(token);
    } catch (_) {
      // Token scaduto/non valido oppure token OAuth pending: la route specifica
      // mantiene la responsabilità di accettarlo o rifiutarlo.
    }

    if (decodedAccess) {
      try {
        const revoked = await isAccessSessionRevoked(decodedAccess);
        if (revoked) {
          return res.status(401).json({
            success: false,
            error: 'Token revocato',
            message: 'Effettua nuovamente il login'
          });
        }
        req.accessTokenDecoded = decodedAccess;
      } catch (error) {
        if (error?.code === 'ACCESS_REVOCATION_STORE_UNAVAILABLE') {
          return res.status(503).json({
            success: false,
            error: 'Verifica sessione temporaneamente non disponibile',
            message: 'Riprova tra poco.'
          });
        }
        throw error;
      }
    }
  }
  
  next();
};

// Middleware per logging errori
const errorLoggingMiddleware = (error, req, res, next) => {
  // Log dell'errore
  logger.logError(error, req, {
    endpoint: req.originalUrl?.split('?')[0],
    method: req.method,
    bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
    queryKeys: req.query && typeof req.query === 'object' ? Object.keys(req.query) : [],
    paramKeys: req.params && typeof req.params === 'object' ? Object.keys(req.params) : []
  }).catch(logError => {
    console.error('❌ Errore logging errore:', logError);
  });
  
  // Risposta standardizzata
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Errore interno del server';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
};

// Middleware per logging performance
const performanceLoggingMiddleware = (operationName) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override del metodo end per catturare performance
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      
      // Log performance
      logger.logPerformance(operationName, duration, {
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode
      }).catch(error => {
        console.error('❌ Errore logging performance:', error);
      });
      
      // Chiama il metodo end originale
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

// Middleware per logging sicurezza
const securityLoggingMiddleware = (req, res, next) => {
  // Log tentativi di accesso sospetti
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script/i,  // XSS
    /union\s+select/i,  // SQL injection
    /or\s+1\s*=\s*1/i  // SQL injection
  ];
  
  const input = JSON.stringify({ ...req.body, ...req.query, ...req.params });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      logger.logSecurity('Tentativo di attacco rilevato', {
        pattern: pattern.toString(),
        bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
        queryKeys: req.query && typeof req.query === 'object' ? Object.keys(req.query) : [],
        paramKeys: req.params && typeof req.params === 'object' ? Object.keys(req.params) : [],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl?.split('?')[0],
        method: req.method
      }).catch(error => {
        console.error('❌ Errore logging sicurezza:', error);
      });
      break;
    }
  }
  
  next();
};

// Middleware per logging audit
const auditLoggingMiddleware = (action, resource) => {
  return (req, res, next) => {
    // Override del metodo end per catturare l'audit
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      if (res.statusCode < 400) { // Solo per richieste riuscite
        logger.logAudit(action, resource, req.user?.id || null, {
          endpoint: req.originalUrl,
          method: req.method,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: req.id
        }).catch(error => {
          console.error('❌ Errore logging audit:', error);
        });
      }
      
      // Chiama il metodo end originale
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

// Middleware per logging database
const databaseLoggingMiddleware = (operation, table) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      await next();
      
      const duration = Date.now() - startTime;
      
      // Log operazione database riuscita
      logger.logPerformance(`DB_${operation}`, duration, {
        table,
        operation,
        endpoint: req.originalUrl
      }).catch(error => {
        console.error('❌ Errore logging database:', error);
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log errore database
      logger.logError(error, req, {
        operation: `DB_${operation}`,
        table,
        duration: `${duration}ms`,
        databaseError: true
      }).catch(logError => {
        console.error('❌ Errore logging errore database:', logError);
      });
      
      throw error; // Re-throw per gestione errori normale
    }
  };
};

// Middleware per logging business logic
const businessLogicLoggingMiddleware = (eventName) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override del metodo end per catturare eventi business
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      if (res.statusCode < 400) {
        const duration = Date.now() - startTime;
        
        logger.info(`Business Event: ${eventName}`, {
          eventName,
          duration: `${duration}ms`,
          endpoint: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode
        }).catch(error => {
          console.error('❌ Errore logging business logic:', error);
        });
      }
      
      // Chiama il metodo end originale
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

// Utility per logging manuale
const logUtils = {
  // Log operazione utente
  logUserAction: (userId, action, details = {}) => {
    logger.logAudit(action, 'user', userId, details);
  },
  
  // Log operazione admin
  logAdminAction: (adminId, action, resource, details = {}) => {
    logger.logAudit(action, resource, adminId, {
      ...details,
      adminAction: true
    });
  },
  
  // Log evento sistema
  logSystemEvent: (event, details = {}) => {
    logger.info(`System Event: ${event}`, {
      ...details,
      systemEvent: true
    });
  },
  
  // Log evento sicurezza
  logSecurityEvent: (event, details = {}) => {
    logger.logSecurity(event, details);
  },
  
  // Log performance operazione
  logOperationPerformance: (operation, duration, details = {}) => {
    logger.logPerformance(operation, duration, details);
  }
};

module.exports = {
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  performanceLoggingMiddleware,
  securityLoggingMiddleware,
  auditLoggingMiddleware,
  databaseLoggingMiddleware,
  businessLogicLoggingMiddleware,
  logUtils
};
