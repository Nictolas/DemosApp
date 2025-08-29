const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../middleware/auth');
const { validateInput, validateEmail } = require('../middleware/validation');
// Importazione condizionale del servizio email
let emailService;
try {
  emailService = require('../services/emailService');
} catch (error) {
  console.log('⚠️ Servizio email non disponibile:', error.message);
  emailService = {
    sendResetPasswordEmail: async () => ({ success: false, error: 'Servizio email non disponibile' }),
    sendVerificationEmail: async () => ({ success: false, error: 'Servizio email non disponibile' })
  };
}

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

// GET /api/auth/check-codice-fiscale - Verifica se un codice fiscale è già registrato
router.get('/check-codice-fiscale', async (req, res) => {
  try {
    const { codice_fiscale } = req.query;
    
    if (!codice_fiscale) {
      return res.status(400).json({
        success: false,
        error: 'Codice fiscale richiesto'
      });
    }
    
    // Verifica se il codice fiscale esiste già
    const result = await pool.query('SELECT id FROM users WHERE codice_fiscale = $1', [codice_fiscale.toUpperCase()]);
    
    if (result.rows.length > 0) {
      res.json({
        success: false,
        message: 'Codice fiscale già registrato nel sistema'
      });
    } else {
      res.json({
        success: true,
        message: 'Codice fiscale disponibile'
      });
    }
  } catch (error) {
    console.error('❌ Errore nella verifica codice fiscale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica codice fiscale'
    });
  }
});

// POST /api/auth/login - Login utente
router.post('/login', validateInput(['email', 'password']), validateEmail, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Tentativo login per:', email);
    
    // Cerca l'utente nel database
    const userQuery = `
      SELECT id, nome, cognome, email, password_hash, ruolo, status, email_verified, 
             avatar_config, created_at, updated_at
      FROM users 
      WHERE email = $1
    `;
    
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenziali non valide'
      });
    }
    
    const user = userResult.rows[0];
    
    // Verifica se l'utente è attivo
    if (user.status !== 'active' && user.status !== 'approved') {
      return res.status(401).json({
        success: false,
        error: 'Account non attivo',
        message: 'Il tuo account non è ancora stato approvato o è stato sospeso'
      });
    }
    
    // Verifica la password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenziali non valide'
      });
    }
    
    // Genera token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.ruolo,
        nome: user.nome,
        cognome: user.cognome
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login riuscito per:', email);
    
    res.json({
      success: true,
      message: 'Login riuscito',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        cognome: user.cognome,
        email: user.email,
        ruolo: user.ruolo,
        status: user.status,
        email_verified: user.email_verified,
        avatar_config: user.avatar_config,
        created_at: user.created_at
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel login:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/auth/verify-email - Verifica email utente
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token di verifica richiesto'
      });
    }
    
    console.log('🔍 Tentativo verifica email con token:', token);
    
    // Verifica il token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({
        success: false,
        error: 'Token di verifica non valido o scaduto'
      });
    }
    
    if (decoded.type !== 'email_verification') {
      return res.status(400).json({
        success: false,
        error: 'Tipo di token non valido'
      });
    }
    
    // Verifica se l'utente esiste e ha status pending
    const userQuery = 'SELECT id, email, status FROM users WHERE email = $1 AND status = $2';
    const userResult = await pool.query(userQuery, [decoded.email, 'pending']);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Utente non trovato o già verificato'
      });
    }
    
    const user = userResult.rows[0];
    
    // Aggiorna lo status dell'utente e marca l'email come verificata
    await pool.query(
      'UPDATE users SET status = $1, email_verified = true, updated_at = NOW() WHERE id = $2',
      ['approved', user.id]
    );
    
    console.log('✅ Email verificata per:', user.email);
    
    res.json({
      success: true,
      message: 'Email verificata con successo! Il tuo account è ora attivo.'
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica email:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica email'
    });
  }
});

// POST /api/auth/resend-verification - Reinvia email di verifica
router.post('/resend-verification', validateInput(['email']), validateEmail, async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('📧 Tentativo reinvio email di verifica per:', email);
    
    // Verifica se l'utente esiste e ha status pending
    const userQuery = 'SELECT id, nome, cognome, email, email_verification_token FROM users WHERE email = $1 AND status = $2';
    const userResult = await pool.query(userQuery, [email.toLowerCase(), 'pending']);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato o già verificato'
      });
    }
    
    const user = userResult.rows[0];
    
    // Se non ha un token di verifica, ne genera uno nuovo
    let verificationToken = user.email_verification_token;
    if (!verificationToken) {
      verificationToken = jwt.sign(
        { 
          email: user.email,
          type: 'email_verification'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Aggiorna il token nel database
      await pool.query(
        'UPDATE users SET email_verification_token = $1 WHERE id = $2',
        [verificationToken, user.id]
      );
    }
    
    // Invia email di verifica
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(email, verificationToken, verificationUrl);
    
    console.log('✅ Email di verifica reinviata per:', email);
    
    res.json({
      success: true,
      message: 'Email di verifica reinviata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel reinvio email di verifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel reinvio email di verifica'
    });
  }
});

// POST /api/auth/register - Registrazione utente
router.post('/register', validateInput(['email', 'password', 'nome', 'cognome']), validateEmail, async (req, res) => {
  try {
    const { email, password, nome, cognome, codice_fiscale } = req.body;
    
    console.log('📝 Tentativo di registrazione per:', email);
    
    // Verifica se l'utente esiste già
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Utente già esistente con questa email'
      });
    }
    
    // Verifica se il codice fiscale è già registrato
    if (codice_fiscale) {
      const existingCodiceFiscale = await pool.query('SELECT id FROM users WHERE codice_fiscale = $1', [codice_fiscale.toUpperCase()]);
      
      if (existingCodiceFiscale.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Codice fiscale già registrato nel sistema'
        });
      }
    }
    
    // Hash della password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Genera token di verifica email (valido per 24 ore)
    const verificationToken = jwt.sign(
      { 
        email: email.toLowerCase(),
        type: 'email_verification'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Inserisci nuovo utente con status "pending"
    const insertQuery = `
      INSERT INTO users (nome, cognome, email, password_hash, ruolo, codice_fiscale, status, email_verification_token, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, nome, cognome, email, ruolo, codice_fiscale, status
    `;
    
    const result = await pool.query(insertQuery, [
      nome, 
      cognome, 
      email.toLowerCase(), 
      passwordHash, 
      'Elettore',
      codice_fiscale ? codice_fiscale.toUpperCase() : null,
      'pending',
      verificationToken
    ]);
    
    const newUser = result.rows[0];
    
    // Invia email di verifica
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/verify-email?token=${verificationToken}`;
      await emailService.sendVerificationEmail(email, verificationToken, verificationUrl);
      
      console.log('✅ Email di verifica inviata per:', email);
      
      res.json({
        success: true,
        message: 'Registrazione completata! Controlla la tua email per confermare l\'account.',
        user: {
          id: newUser.id,
          name: newUser.nome,
          cognome: newUser.cognome,
          email: newUser.email,
          ruolo: newUser.ruolo,
          codice_fiscale: newUser.codice_fiscale,
          status: newUser.status
        },
        requiresVerification: true
      });
      
    } catch (emailError) {
      console.error('❌ Errore nell\'invio email di verifica:', emailError);
      
      // Se l'email non può essere inviata, elimina l'utente e restituisci errore
      await pool.query('DELETE FROM users WHERE id = $1', [newUser.id]);
      
      res.status(500).json({
        success: false,
        error: 'Errore nell\'invio email di verifica. Riprova più tardi.'
      });
    }
    
  } catch (error) {
    console.error('❌ Errore nella registrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella registrazione'
    });
  }
});

// POST /api/auth/forgot-password - Richiesta reset password
router.post('/forgot-password', validateInput(['email']), validateEmail, async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('🔐 Richiesta reset password per:', email);
    console.log('🔍 DEBUG - Verificando esistenza utente nel database...');
    
    // Verifica se l'utente esiste
    const userQuery = 'SELECT id, nome, cognome FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);
    
    console.log('🔍 DEBUG - Query result:', userResult.rows);
    
    if (userResult.rows.length === 0) {
      // Per sicurezza, non rivelare se l'email esiste o meno
      console.log('⚠️ Tentativo reset password per email non esistente:', email);
      return res.json({
        success: true,
        message: 'Se l\'email esiste, riceverai un link per il reset della password'
      });
    }
    
    const user = userResult.rows[0];
    console.log('✅ DEBUG - Utente trovato:', { id: user.id, nome: user.nome, cognome: user.cognome });
    
    // Genera token di reset (valido per 1 ora)
    const resetToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'password_reset'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('🔑 DEBUG - Token generato per utente:', user.id);
    
    // Salva il token nel database
    try {
      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
        [resetToken, user.id]
      );
      console.log('💾 DEBUG - Token salvato nel database per utente:', user.id);
    } catch (dbError) {
      console.error('❌ DEBUG - Errore nel salvare token nel database:', dbError);
      throw dbError;
    }
    
    // Invia email di reset con Resend
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/reset-password-confirm?token=${resetToken}`;
      console.log('🔗 DEBUG - Reset URL generato:', resetUrl);
      console.log('📧 DEBUG - Tentativo invio email tramite Resend...');
      
      const emailResult = await emailService.sendResetPasswordEmail(email, resetToken, resetUrl);
      
      if (emailResult.success) {
        console.log('✅ Email di reset inviata con successo tramite Resend per:', email);
        
        res.json({
          success: true,
          message: 'Link di reset inviato alla tua email. Controlla la casella di posta.'
        });
      } else {
        console.log('❌ Fallimento invio email per:', email);
        res.status(500).json({
          success: false,
          error: 'Errore nell\'invio dell\'email. Riprova più tardi.'
        });
      }
    } catch (emailError) {
      console.error('❌ Errore critico nell\'invio email con Resend:', emailError);
      console.error('❌ DEBUG - Dettagli errore email:', {
        message: emailError.message,
        stack: emailError.stack,
        email: email,
        userId: user.id
      });
      
      // Fallback: restituisci il token per sviluppo/test
      if (process.env.NODE_ENV === 'development' || !process.env.RESEND_API_KEY) {
        console.log('⚠️ Modalità fallback: restituzione token per sviluppo');
        res.json({
          success: true,
          message: 'Link di reset generato (modalità sviluppo). Usa il token per testare.',
          resetToken: resetToken,
          resetUrl: `${process.env.FRONTEND_URL || 'https://www.demos.community'}/reset-password-confirm?token=${resetToken}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Errore nell\'invio dell\'email. Riprova più tardi.'
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Errore nella richiesta reset password:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/auth/reset-password - Reset password con token
router.post('/reset-password', validateInput(['token', 'newPassword']), async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    console.log('🔐 Tentativo reset password con token');
    
    // Verifica il token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({
        success: false,
        error: 'Token di reset non valido o scaduto'
      });
    }
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        error: 'Tipo di token non valido'
      });
    }
    
    // Verifica se l'utente esiste e ha un token valido
    const userQuery = `
      SELECT id, email, reset_token, reset_token_expires 
      FROM users 
      WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()
    `;
    
    const userResult = await pool.query(userQuery, [decoded.userId, token]);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Token di reset non valido o scaduto'
      });
    }
    
    const user = userResult.rows[0];
    
    // Hash della nuova password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Aggiorna la password e rimuovi il token di reset
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );
    
    console.log('✅ Password resettata con successo per:', user.email);
    
    res.json({
      success: true,
      message: 'Password resettata con successo! Ora puoi effettuare il login con la nuova password.'
    });
    
  } catch (error) {
    console.error('❌ Errore nel reset password:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel reset password'
    });
  }
});

module.exports = router;
