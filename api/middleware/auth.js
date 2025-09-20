// File: api/middleware/auth.js
const { verifyAccessToken, revokeToken } = require('../utils/jwt');
const { Pool } = require('pg');

// Configurazione database diretta (senza dipendenze esterne)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Aumento timeout
});

// Middleware per verificare il token JWT
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token di accesso richiesto'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyAccessToken(token);
      req.user = {
        id: decoded.userId || decoded.email,
        role: decoded.role || decoded.ruolo,
        email: decoded.email,
        jti: decoded.jti // JWT ID per tracking
      };
      req.userId = decoded.userId || decoded.email;
      req.userRole = decoded.role || decoded.ruolo;
      req.userEmail = decoded.email;
      
      console.log('🔐 DEBUG - Token verificato per utente:', req.user.id, 'con ruolo:', req.user.role);
      
      next();
    } catch (jwtError) {
      console.error('❌ Errore verifica JWT:', jwtError.message);
      
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
    console.error('❌ Errore nel middleware verifyToken:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
};

// Middleware per richiedere ruolo admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.userRole || req.userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Richiesto ruolo amministratore'
      });
    }
    
    console.log('👑 DEBUG - Accesso admin verificato per utente:', req.userId);
    next();
  } catch (error) {
    console.error('❌ Errore nel middleware requireAdmin:', error);
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
