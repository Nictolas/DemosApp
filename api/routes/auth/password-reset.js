const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');
const { validateInput, validateEmail } = require('../../middleware/validation');

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

// Importazione condizionale del servizio email
let emailService;
try {
  emailService = require('../../services/emailService');
} catch (error) {
  console.log('⚠️ Servizio email non disponibile:', error.message);
  emailService = {
    sendResetPasswordEmail: async () => ({ success: false, error: 'Servizio email non disponibile' })
  };
}

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
    console.log('✅ Utente trovato per reset password:', user.email);
    
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
    
    // Salva il token nel database
    const updateQuery = `
      UPDATE users 
      SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour', updated_at = NOW()
      WHERE id = $2
    `;
    
    await pool.query(updateQuery, [resetToken, user.id]);
    console.log('✅ Token di reset salvato nel database per:', user.email);
    
    // Invia email di reset
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/reset-password-confirm?token=${resetToken}`;
      await emailService.sendResetPasswordEmail(email, resetToken, resetUrl);
      
      console.log('✅ Email di reset password inviata per:', email);
      
      res.json({
        success: true,
        message: 'Link di reset password inviato! Controlla la tua email.'
      });
      
    } catch (emailError) {
      console.error('❌ Errore nell\'invio email di reset:', emailError);
      
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
