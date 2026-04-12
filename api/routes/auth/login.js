const express = require('express');
const bcrypt = require('bcryptjs');
const { generateTokenPair, verifyRefreshToken } = require('../../utils/jwt');
const { requireAdmin } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiting');
const { getPool } = require('../../config/database');

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

/**
 * 🔐 LOGIN UTENTE
 * POST /api/auth/login
 */
router.post('/login', 
  authLimiter,
  async (req, res) => {
    const startTime = Date.now();
    console.log(`🚀 LOGIN START: ${req.body?.email || 'Nessuna email'} - ${new Date().toISOString()}`);
    console.log(`🚀 LOGIN DEBUG: Method: ${req.method}, Path: ${req.path}, URL: ${req.url}`);
    console.log(`🚀 LOGIN DEBUG: IP: ${req.ip}, Headers:`, JSON.stringify(req.headers));
    console.log(`🚀 LOGIN DEBUG: Body:`, JSON.stringify(req.body));
    console.log(`🚀 LOGIN DEBUG: Rate limiter superato, procedendo con la richiesta...`);
    
    try {
      // Verifica che il body sia parsato correttamente
      if (!req.body) {
        console.error('❌ LOGIN ERROR: req.body è undefined o null');
        return res.status(400).json({
          success: false,
          error: 'Body della richiesta non valido',
          message: 'La richiesta deve contenere email e password in formato JSON'
        });
      }
      
      const { email, password } = req.body;
      console.log(`📧 Email ricevuta: ${email}`);

      // Cerca utente nel database (tabella users)
      console.log(`🔍 Query database per utente...`);
      const userQuery = `
        SELECT id, email, password_hash, ruolo, nome, cognome, 
               created_at, status
        FROM users 
        WHERE email = $1 AND (status = 'A' OR status = 'a')
      `;
      
      const queryStart = Date.now();
      let userResult;
      try {
        // Imposta un timeout specifico per questa query (25 secondi)
        userResult = await Promise.race([
          pool.query(userQuery, [email.toLowerCase()]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout dopo 25 secondi')), 25000)
          )
        ]);
      } catch (queryError) {
        const queryTime = Date.now() - queryStart;
        console.error(`❌ Errore query database dopo ${queryTime}ms:`, queryError.message);
        throw new Error('Errore di connessione al database. Riprova tra qualche istante.');
      }
      
      const queryTime = Date.now() - queryStart;
      console.log(`⏱️ Query database completata in ${queryTime}ms`);
      console.log(`📊 Risultato query: ${userResult.rows.length} righe trovate`);
      
      if (userResult.rows.length === 0) {
        console.log(`❌ Utente non trovato per email: ${email}`);
        return res.status(401).json({
          success: false,
          error: 'Credenziali non valide',
          message: 'Email o password errati'
        });
      }

      const user = userResult.rows[0];
      console.log(`👤 Utente trovato: ${user.email} (ID: ${user.id})`);

      // Verifica password
      console.log(`🔐 Verifica password...`);
      console.log(`🔍 Password ricevuta: ${password ? 'presente' : 'mancante'}`);
      console.log(`🔍 Password hash nel DB: ${user.password_hash ? 'presente' : 'mancante'}`);
      const passwordStart = Date.now();
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      const passwordTime = Date.now() - passwordStart;
      console.log(`⏱️ Verifica password completata in ${passwordTime}ms`);
      console.log(`🔐 Password valida: ${isValidPassword}`);
      
      if (!isValidPassword) {
        console.log(`❌ Password non valida per ${email}`);
        return res.status(401).json({
          success: false,
          error: 'Credenziali non valide',
          message: 'Email o password errati'
        });
      }

      // Aggiorna ultimo login
      // NOTE: Il token FCM viene gestito automaticamente da useSyncFcmToken nel frontend
      // tramite l'endpoint /api/fcm-tokens, quindi non serve gestirlo qui
      console.log(`📝 Aggiornamento ultimo login...`);
      const updateStart = Date.now();
      await pool.query(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      const updateTime = Date.now() - updateStart;
      console.log(`⏱️ Aggiornamento ultimo login completato in ${updateTime}ms`);

      // Genera token
      console.log(`🎫 Generazione token...`);
      const tokenStart = Date.now();
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.ruolo,
        nome: user.nome,
        cognome: user.cognome
      };

      const tokens = generateTokenPair(tokenPayload);
      const tokenTime = Date.now() - tokenStart;
      console.log(`⏱️ Generazione token completata in ${tokenTime}ms`);

      const totalTime = Date.now() - startTime;
      console.log(`🎉 LOGIN SUCCESS: ${user.email} - Tempo totale: ${totalTime}ms`);

      const responseData = {
        success: true,
        message: 'Login effettuato con successo',
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          cognome: user.cognome,
          ruolo: user.ruolo,
          created_at: user.created_at
        },
        ...tokens
      };
      
      console.log(`📤 LOGIN: Invio risposta con accessToken: ${!!responseData.accessToken}`);
      
      // Assicurati che la risposta venga inviata correttamente
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(responseData);
      
      console.log(`✅ LOGIN: Risposta inviata correttamente`);

    } catch (error) {
      console.error('❌ Errore durante il login:', error);
      console.error('❌ Stack trace:', error.stack);
      
      // Assicurati che la risposta di errore venga inviata
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Errore interno del server',
          message: 'Impossibile completare il login',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      } else {
        console.error('❌ LOGIN: Headers già inviati, impossibile inviare risposta di errore');
      }
    }
  }
);

/**
 * 🔄 REFRESH TOKEN
 * POST /api/auth/refresh
 */
router.post('/refresh',
  authLimiter,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      // Verifica refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Cerca utente nel database
      const userQuery = `
        SELECT id, email, ruolo, nome, cognome, status
        FROM users 
        WHERE id = $1 AND (status = 'A' OR status = 'a')
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
        try {
          const { verifyAccessToken } = require('../../utils/jwt');
          const { invalidateAuthUserCache } = require('../../services/redisCache');
          const decoded = verifyAccessToken(token);
          const uid = decoded.userId || decoded.sub || decoded.id;
          if (uid) await invalidateAuthUserCache(String(uid));
        } catch (_) {
          /* token scaduto/invalido: la revoca resta utile se decodificabile */
        }
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