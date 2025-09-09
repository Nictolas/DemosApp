// File: api/middleware/auth.js
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configurazione database diretta (senza dipendenze esterne)
const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        // Produzione: usa DATABASE_URL (formato standard per Render, Vercel, etc.)
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        // Sviluppo: usa credenziali specifiche
        user: process.env.DB_USER || 'xeadylil_Nicolas',
        password: process.env.DB_PASSWORD || 'N1Nj6tAu789',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'xeadylil_demos',
        ssl: process.env.DB_SSL === 'true' || false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = {
        id: decoded.userId || decoded.email,
        role: decoded.role || decoded.ruolo,
        email: decoded.email
      };
      req.userId = decoded.userId || decoded.email;
      req.userRole = decoded.role || decoded.ruolo;
      req.userEmail = decoded.email;
      
      console.log('🔐 DEBUG - Token verificato per utente:', req.user.id, 'con ruolo:', req.user.role);
      
      next();
    } catch (jwtError) {
      console.error('❌ Errore verifica JWT:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token scaduto',
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
