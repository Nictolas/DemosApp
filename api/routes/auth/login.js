const express = require('express');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { generateTokenPair, verifyRefreshToken } = require('../../utils/jwt');
const { validateInput, sanitizeInput } = require('../../middleware/security');
const { authLimiter } = require('../../middleware/rateLimiting');

const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

/**
 * 🔐 LOGIN UTENTE
 * POST /api/auth/login
 */
router.post('/login', 
  authLimiter,
  sanitizeInput,
  validateInput(['email', 'password']),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Cerca utente nel database
      const userQuery = `
        SELECT id, email, password, ruolo, nome, cognome, 
               email_verified, created_at, last_login
        FROM users 
        WHERE email = $1 AND status = 'active'
      `;
      
      const userResult = await pool.query(userQuery, [email.toLowerCase()]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Credenziali non valide',
          message: 'Email o password errati'
        });
      }

      const user = userResult.rows[0];

      // Verifica password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Credenziali non valide',
          message: 'Email o password errati'
        });
      }

      // Verifica se l'email è verificata
      if (!user.email_verified) {
        return res.status(403).json({
          success: false,
          error: 'Email non verificata',
          message: 'Verifica la tua email prima di effettuare il login'
        });
      }

      // Aggiorna ultimo login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Genera token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.ruolo,
        nome: user.nome,
        cognome: user.cognome
      };

      const tokens = generateTokenPair(tokenPayload);

      // Log del login
      console.log(`🔐 Login riuscito per utente: ${user.email} (ID: ${user.id})`);

      res.json({
        success: true,
        message: 'Login effettuato con successo',
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          cognome: user.cognome,
          ruolo: user.ruolo,
          lastLogin: user.last_login
        },
        ...tokens
      });

    } catch (error) {
      console.error('❌ Errore durante il login:', error);
      res.status(500).json({
        success: false,
        error: 'Errore interno del server',
        message: 'Impossibile completare il login'
      });
    }
  }
);

/**
 * 🔄 REFRESH TOKEN
 * POST /api/auth/refresh
 */
router.post('/refresh',
  authLimiter,
  sanitizeInput,
  validateInput(['refreshToken']),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      // Verifica refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Cerca utente nel database
      const userQuery = `
        SELECT id, email, ruolo, nome, cognome, status
        FROM users 
        WHERE id = $1 AND status = 'active'
      `;
      
      const userResult = await pool.query(userQuery, [decoded.userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Utente non trovato',
          message: 'Effettua nuovamente il login'
        });
      }

      const user = userResult.rows[0];

      // Genera nuovi token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.ruolo,
        nome: user.nome,
        cognome: user.cognome
      };

      const tokens = generateTokenPair(tokenPayload);

      res.json({
        success: true,
        message: 'Token aggiornati con successo',
        ...tokens
      });

    } catch (error) {
      console.error('❌ Errore durante refresh token:', error);
      res.status(401).json({
        success: false,
        error: 'Refresh token non valido',
        message: 'Effettua nuovamente il login'
      });
    }
  }
);

/**
 * 🚪 LOGOUT
 * POST /api/auth/logout
 */
router.post('/logout',
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Revoca il token (aggiunge alla blacklist)
        require('../../utils/jwt').revokeToken(token);
      }

      res.json({
        success: true,
        message: 'Logout effettuato con successo'
      });

    } catch (error) {
      console.error('❌ Errore durante logout:', error);
      res.status(500).json({
        success: false,
        error: 'Errore interno del server',
        message: 'Impossibile completare il logout'
      });
    }
  }
);

module.exports = router;