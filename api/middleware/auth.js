// File: api/middleware/auth.js
const { verifyAccessToken } = require('../utils/jwt');
const { getPool } = require('../config/database');
const redisCache = require('../services/redisCache');
const { keys: cacheKeys, ttl: cacheTtl } = require('../config/cacheKeys');
const { getAccountSubject } = require('../services/accountCapabilitiesService');

// Usa il pool centralizzato ottimizzato
const pool = getPool();

const isProduction = process.env.NODE_ENV === 'production';

// Debug per verificare la connessione al database (solo in sviluppo)
if (!isProduction) {
  console.log('🔍 DEBUG - Pool database inizializzato:', pool ? 'OK' : 'ERRORE');
  console.log('🔍 DEBUG - DATABASE_URL presente:', process.env.DATABASE_URL ? 'OK' : 'MANCANTE');
}

// Middleware per verificare il token JWT
const verifyToken = async (req, res, next) => {
  try {
    const log = (...args) => { if (!isProduction) console.log(...args); };
    const logErr = (...args) => { if (!isProduction) console.error(...args); };

    if (!isProduction && (req.url.includes('/vota') || req.url.includes('/capo-stato') || req.url.includes('/admin/'))) {
      log('🚀 ENTRATA in verifyToken:', req.method, req.url);
      log('🔐 DEBUG verifyToken - URL:', req.url);
      log('🔐 DEBUG verifyToken - Headers authorization:', req.headers.authorization ? 'PRESENTE' : 'MANCANTE');
    }
    log('🔐 DEBUG verifyToken - Pool database:', pool ? 'OK' : 'ERRORE');
    log('🔐 DEBUG verifyToken - DATABASE_URL:', process.env.DATABASE_URL ? 'OK' : 'MANCANTE');

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log('❌ DEBUG verifyToken - Token mancante o formato errato');
      return res.status(401).json({
        success: false,
        error: 'Token di accesso richiesto'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);
      log('🔐 DEBUG verifyToken - Token decodificato:', decoded);
      log('🔐 DEBUG verifyToken - Verifica utente nel database...');

      // In Demos le email non vengono più usate per l'autenticazione:
      // tutti i token (password storica o passkey) contengono sempre userId.
      const userIdFromToken = decoded.userId || decoded.sub || decoded.id;

      if (!userIdFromToken) {
        logErr('❌ DEBUG verifyToken - Token senza userId');
        return res.status(401).json({
          success: false,
          error: 'Token non valido',
          message: 'Effettua nuovamente il login'
        });
      }

      const authCacheTtlSec = cacheTtl.authUser;
      const authCacheKey =
        redisCache.isEnabled() && authCacheTtlSec > 0
          ? cacheKeys.authUser(String(userIdFromToken))
          : null;

      let user;
      if (authCacheKey) {
        const cached = await redisCache.getJson(authCacheKey);
        if (
          cached &&
          cached.id != null &&
          cached.status != null &&
          cached.legacyRole != null &&
          cached.capabilities != null
        ) {
          user = cached;
          log('🔐 DEBUG verifyToken - Cache auth hit per user:', userIdFromToken);
        }
      }

      if (!user) {
        try {
          user = await getAccountSubject(pool, userIdFromToken);
          log('🔐 DEBUG verifyToken - Modello account caricato:', user ? 'OK' : 'NON TROVATO');
        } catch (dbError) {
          logErr('❌ DEBUG verifyToken - Errore database:', dbError.message);
          if (!isProduction) logErr('❌ DEBUG verifyToken - Stack database:', dbError.stack);
          throw dbError;
        }

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Utente non trovato',
            message: 'Effettua nuovamente il login'
          });
        }

        if (authCacheKey && authCacheTtlSec > 0) {
          await redisCache.setJson(authCacheKey, user, authCacheTtlSec);
        }
      }

      if (user.status !== 'a') {
        return res.status(401).json({
          success: false,
          error: 'Account non attivo',
          message: `Il tuo account ha status "${user.status}". Contatta l'amministratore per l'attivazione.`
        });
      }

      req.user = {
        id: user.id,
        role: user.legacyRole,
        legacyRole: user.legacyRole,
        status: user.status,
        accountType: user.capabilities.accountType,
        isAdmin: user.capabilities.isAdmin,
        isActivist: user.capabilities.isActivist,
        isCandidate: user.capabilities.isCandidate,
        isPolitician: user.capabilities.isPolitician,
        capabilities: user.capabilities,
        jti: decoded.jti
      };
      req.userId = user.id;
      req.userRole = user.legacyRole;
      req.userEmail = null;

      log('🔐 DEBUG - Token verificato per utente:', req.user.id, 'ruolo:', req.user.role);

      next();
    } catch (jwtError) {
      if (!isProduction) console.error('❌ Errore verifica JWT:', jwtError.message);
      if (!isProduction) console.error('❌ Stack JWT:', jwtError.stack);

      if (jwtError.message.includes('scaduto') || jwtError.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          error: 'Token scaduto',
          message: 'Effettua nuovamente il login'
        });
      }
      
      if (jwtError.message.includes('revocato')) {
        return res.status(401).json({
          success: false,
          error: 'Token revocato',
          message: 'Effettua nuovamente il login'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Token non valido',
        message: 'Effettua nuovamente il login'
      });
    }
  } catch (error) {
    if (isProduction) {
      console.error('❌ Errore nel middleware verifyToken');
    } else {
      console.error('❌ Errore nel middleware verifyToken:', error.message);
    }
    if (!isProduction) {
      console.error('❌ Stack trace verifyToken:', error.stack);
      console.error('❌ Error details verifyToken:', { message: error.message, code: error.code, detail: error.detail, hint: error.hint });
    }
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

// Middleware per richiedere ruolo admin
const requireAdmin = async (req, res, next) => {
  try {
    // Verifica che verifyToken sia stato eseguito prima
    if (!req.user) {
      if (!isProduction) console.log('❌ DEBUG requireAdmin - Utente non autenticato');
      return res.status(401).json({
        success: false,
        error: 'Token di accesso richiesto',
        message: 'Effettua il login per continuare'
      });
    }
    
    if (!isProduction) {
      console.log('👑 DEBUG requireAdmin - isAdmin capability:', req.user.isAdmin);
    }
    if (!req.user.isAdmin) {
      if (!isProduction) console.log('❌ DEBUG requireAdmin - Capability Admin assente');
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Richiesto ruolo amministratore'
      });
    }
    
    if (!isProduction) console.log('👑 DEBUG - Accesso admin verificato per utente:', req.userId);
    next();
  } catch (error) {
    if (!isProduction) console.error('❌ Errore nel middleware requireAdmin:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

// Middleware per verificare che l'utente stia modificando il proprio profilo
const requireOwnProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (req.userId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Puoi modificare solo il tuo profilo'
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ Errore nel middleware requireOwnProfile:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireOwnProfile,
  pool
};
