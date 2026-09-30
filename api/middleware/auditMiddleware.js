const AuditService = require('../services/auditService');

/**
 * Middleware per logging automatico delle operazioni sui dati
 * @param {Object} options - Opzioni di configurazione
 * @param {string} options.resource - Nome della risorsa (es. 'users', 'votes', 'opinions')
 * @param {string} options.action - Tipo di azione (es. 'DATA_ACCESS', 'DATA_MODIFY', 'DATA_DELETE')
 * @param {Function} options.getResourceId - Funzione per estrarre l'ID della risorsa dalla richiesta
 * @param {Function} options.getDetails - Funzione per estrarre dettagli aggiuntivi dalla richiesta
 */
const auditMiddleware = (options = {}) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Estrai informazioni dalla richiesta
    const userId = req.userId || req.user?.id || 'anonymous';
    const includeNetworkIdentifiers = options.includeNetworkIdentifiers === true;
    const ipAddress = includeNetworkIdentifiers
      ? (req.ip || req.connection?.remoteAddress || null)
      : null;
    const userAgent = includeNetworkIdentifiers
      ? (req.get('User-Agent') || null)
      : null;
    const method = req.method;
    const path = (req.originalUrl || req.path || '').split('?')[0];
    
    // Determina l'azione basata sul metodo HTTP
    let action = options.action;
    if (!action) {
      switch (method) {
        case 'GET':
          action = 'DATA_ACCESS';
          break;
        case 'POST':
          action = 'DATA_CREATE';
          break;
        case 'PUT':
        case 'PATCH':
          action = 'DATA_MODIFY';
          break;
        case 'DELETE':
          action = 'DATA_DELETE';
          break;
        default:
          action = 'DATA_OPERATION';
      }
    }
    
    // Estrai ID risorsa se specificato
    let resourceId = null;
    if (options.getResourceId) {
      try {
        resourceId = options.getResourceId(req);
      } catch (error) {
        console.warn('Errore nell\'estrazione resourceId:', error);
      }
    } else {
      // Estrazione automatica da params
      resourceId = req.params.id || req.params.userId || req.params.opinioneId;
    }
    
    // Estrai dettagli aggiuntivi se specificato
    let details = {};
    if (options.getDetails) {
      try {
        details = options.getDetails(req) || {};
      } catch (error) {
        console.warn('Errore nell\'estrazione dettagli:', error);
      }
    }
    
    // Aggiungi dettagli standard
    details = {
      ...details,
      method,
      path,
      timestamp: new Date().toISOString()
    };
    
    // Intercetta la risposta per determinare il successo
    res.send = function(data) {
      logAuditAction();
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      logAuditAction(data);
      return originalJson.call(this, data);
    };
    
    // Funzione per loggare l'azione
    const logAuditAction = (responseData = null) => {
      try {
        // Determina se l'operazione è riuscita
        const success = res.statusCode >= 200 && res.statusCode < 400;
        let errorMessage = null;
        
        if (!success) {
          errorMessage = `HTTP ${res.statusCode}`;
          if (responseData && responseData.error) {
            errorMessage += `: ${responseData.error}`;
          }
        }
        
        // Log dell'azione
        AuditService.logAction({
          userId,
          action,
          resource: options.resource || 'unknown',
          resourceId,
          details,
          ipAddress,
          userAgent,
          success,
          errorMessage
        });
      } catch (error) {
        console.error('Errore nel logging audit:', error);
        // Non bloccare la risposta per errori di audit
      }
    };
    
    next();
  };
};

const isAdminRole = (role) => ['AD', 'Admin'].includes(String(role || '').trim());

const shouldAuditPoliticalOpinionAccess = ({ requesterId, requesterRole, targetId }) =>
  Boolean(
    requesterId &&
    targetId &&
    String(requesterId) !== String(targetId) &&
    isAdminRole(requesterRole)
  );

/**
 * Audit minimo per accessi eccezionali alle opinioni politiche:
 * - self access: nessun audit identificante;
 * - normale accesso a figure pubbliche: nessun audit identificante;
 * - admin che legge le opinioni di un altro utente: actor + target + esito,
 *   senza IP, user-agent, sessione o contenuto delle opinioni.
 */
const politicalOpinionAccessAuditMiddleware = (req, res, next) => {
  const requesterId = req.userId || req.user?.id || null;
  const targetId = req.params?.userId || null;
  const requesterRole = req.userRole || req.user?.ruolo || req.user?.role || null;

  if (!shouldAuditPoliticalOpinionAccess({ requesterId, requesterRole, targetId })) {
    return next();
  }

  let logged = false;
  res.on('finish', () => {
    if (logged) return;
    logged = true;

    AuditService.logAction({
      userId: requesterId,
      action: 'ADMIN_POLITICAL_OPINION_ACCESS',
      resource: 'political_opinions',
      resourceId: targetId,
      details: {
        method: req.method,
        status_code: res.statusCode
      },
      ipAddress: null,
      userAgent: null,
      success: res.statusCode >= 200 && res.statusCode < 400,
      errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null
    }).catch((error) => {
      console.error('Errore nel logging audit opinioni politiche admin:', error);
    });
  });

  next();
};

/**
 * Middleware specifico per operazioni sui dati utente
 */
const userDataAuditMiddleware = auditMiddleware({
  resource: 'users',
  getResourceId: (req) => req.params.userId || req.params.id || req.userId,
  getDetails: (req) => ({
    operation: req.route?.path || req.path,
    query_fields: Object.keys(req.query || {}).length > 0 ? Object.keys(req.query) : undefined,
    body_fields: req.body && typeof req.body === 'object' ? Object.keys(req.body) : undefined
  })
});

/**
 * Middleware specifico per operazioni sui voti
 */
const voteDataAuditMiddleware = auditMiddleware({
  resource: 'votes',
  getResourceId: (req) => req.params.voteId || req.params.id,
  getDetails: (req) => ({
    vote_type: req.params.voteType || 'unknown',
    operation: req.route?.path || req.path
  })
});

/**
 * Middleware specifico per operazioni sulle opinioni
 */
const opinionDataAuditMiddleware = auditMiddleware({
  resource: 'opinions',
  getResourceId: (req) => req.params.opinioneId || req.params.id,
  getDetails: (req) => ({
    operation: req.route?.path || req.path,
    opinion_type: req.body?.type || 'unknown'
  })
});

/**
 * Middleware specifico per operazioni sui rappresentanti
 */
const representativeDataAuditMiddleware = auditMiddleware({
  resource: 'representatives',
  getResourceId: (req) => req.params.representativeId || req.params.id,
  getDetails: (req) => ({
    operation: req.route?.path || req.path,
    representative_type: req.body?.tipo || 'unknown'
  })
});

/**
 * Middleware per operazioni di amministrazione
 */
const adminAuditMiddleware = auditMiddleware({
  resource: 'admin',
  action: 'ADMIN_OPERATION',
  getResourceId: (req) => req.params.id || req.userId,
  getDetails: (req) => ({
    operation: req.route?.path || req.path,
    admin_action: req.body?.action || 'unknown',
    target_resource: req.body?.target || 'unknown'
  })
});

/**
 * Middleware per operazioni di autenticazione
 */
const authAuditMiddleware = auditMiddleware({
  resource: 'authentication',
  action: 'AUTH_OPERATION',
  getResourceId: (req) => req.userId || 'anonymous',
  getDetails: (req) => ({
    operation: req.route?.path || req.path,
    auth_method: req.body?.method || 'unknown',
    success: req.body?.success || false
  })
});

module.exports = {
  auditMiddleware,
  userDataAuditMiddleware,
  voteDataAuditMiddleware,
  opinionDataAuditMiddleware,
  representativeDataAuditMiddleware,
  adminAuditMiddleware,
  authAuditMiddleware,
  politicalOpinionAccessAuditMiddleware,
  shouldAuditPoliticalOpinionAccess
};
