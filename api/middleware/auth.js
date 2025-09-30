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
      
      // Verifica che l'utente esista e sia attivo
      const userResult = await pool.query(
        'SELECT id, email, status, ruolo FROM users WHERE id = $1 OR email = $2',
        [decoded.userId || decoded.email, decoded.email]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Utente non trovato',
          message: 'Effettua nuovamente il login'
        });
      }
      
      const user = userResult.rows[0];
      
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          error: 'Account non attivo',
          message: `Il tuo account ha status "${user.status}". Contatta l'amministratore per l'attivazione.`
        });
      }
      
      req.user = {
        id: user.id,
        role: user.ruolo,
        email: user.email,
        status: user.status,
        jti: decoded.jti // JWT ID per tracking
      };
      req.userId = user.id;
      req.userRole = user.ruolo;
      req.userEmail = user.email;
      
      console.log('🔐 DEBUG - Token verificato per utente:', req.user.id, 'con ruolo:', req.user.role, 'status:', req.user.status);
      
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
