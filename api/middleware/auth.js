// File: api/middleware/auth.js
const { verifyAccessToken, revokeToken } = require('../utils/jwt');
const { getPool } = require('../config/database');

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// Debug per verificare la connessione al database
console.log('🔍 DEBUG - Pool database inizializzato:', pool ? 'OK' : 'ERRORE');
console.log('🔍 DEBUG - DATABASE_URL presente:', process.env.DATABASE_URL ? 'OK' : 'MANCANTE');

// Middleware per verificare il token JWT
const verifyToken = async (req, res, next) => {
  try {
    // Log per endpoint critici e admin
    if (req.url.includes('/vota') || req.url.includes('/capo-stato') || req.url.includes('/admin/')) {
      console.log('🚀🚀🚀 ENTRATA in verifyToken middleware per:', req.method, req.url);
      console.log('🔐 DEBUG verifyToken - Inizio verifica token');
      console.log('🔐 DEBUG verifyToken - URL:', req.url);
      console.log('🔐 DEBUG verifyToken - Headers authorization:', req.headers.authorization ? 'PRESENTE' : 'MANCANTE');
      if (req.headers.authorization) {
        console.log('🔐 DEBUG verifyToken - Authorization header:', req.headers.authorization.substring(0, 50) + '...');
      }
    }
    console.log('🔐 DEBUG verifyToken - Pool database:', pool ? 'OK' : 'ERRORE');
    console.log('🔐 DEBUG verifyToken - DATABASE_URL:', process.env.DATABASE_URL ? 'OK' : 'MANCANTE');
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ DEBUG verifyToken - Token mancante o formato errato');
      return res.status(401).json({
        success: false,
        error: 'Token di accesso richiesto'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyAccessToken(token);
      console.log('🔐 DEBUG verifyToken - Token decodificato:', decoded);
      
      // Verifica che l'utente esista e sia attivo
      console.log('🔐 DEBUG verifyToken - Verifica utente nel database...');
      console.log('🔐 DEBUG verifyToken - Pool database:', pool ? 'OK' : 'ERRORE');
      
      // Test connessione database
      let userResult;
      try {
        userResult = await pool.query(
          'SELECT id, email, status, ruolo FROM users WHERE id = $1 OR email = $2',
          [decoded.userId || decoded.email, decoded.email]
        );
        console.log('🔐 DEBUG verifyToken - Risultato query utente:', userResult.rows.length, 'righe');
      } catch (dbError) {
        console.error('❌ DEBUG verifyToken - Errore database:', dbError.message);
        console.error('❌ DEBUG verifyToken - Stack database:', dbError.stack);
        throw dbError;
      }
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Utente non trovato',
          message: 'Effettua nuovamente il login'
        });
      }
      
      const user = userResult.rows[0];
      
      if (user.status !== 'a') {
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
    console.error('❌ Stack trace verifyToken:', error.stack);
    console.error('❌ Error details verifyToken:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
};

// Middleware per richiedere ruolo admin
const requireAdmin = async (req, res, next) => {
  try {
    console.log('👑 DEBUG requireAdmin - Verifica ruolo admin');
    console.log('👑 DEBUG requireAdmin - req.userRole:', req.userRole);
    console.log('👑 DEBUG requireAdmin - req.userId:', req.userId);
    console.log('👑 DEBUG requireAdmin - req.userEmail:', req.userEmail);
    
    if (!req.userRole || req.userRole !== 'AD') {
      console.log('❌ DEBUG requireAdmin - Ruolo non admin:', req.userRole);
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
