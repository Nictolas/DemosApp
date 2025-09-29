const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');
const { validateInput, validateEmail } = require('../../middleware/validation');

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Importazione condizionale del servizio email
let emailService;
try {
  emailService = require('../../services/emailService');
} catch (error) {
  console.log('⚠️ Servizio email non disponibile:', error.message);
  emailService = {
    sendVerificationEmail: async () => ({ success: false, error: 'Servizio email non disponibile' })
  };
}


// POST /api/auth/verify-email - Verifica email con token
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token di verifica richiesto'
      });
    }
    
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
    
    // Aggiorna lo status dell'utente e rimuovi il token
    const result = await pool.query(
      'UPDATE users SET status = $1, email_verification_token = NULL, updated_at = NOW() WHERE email = $2 AND email_verification_token = $3',
      ['active', decoded.email, token]
    );
    
    if (result.rowCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Token di verifica non valido o utente non trovato'
      });
    }
    
    console.log('✅ Email verificata per:', decoded.email);
    
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
    
    console.log('📧 Richiesta reinvio verifica email per:', email);
    
    // Verifica se l'utente esiste e ha bisogno di verifica
    const userQuery = `
      SELECT id, nome, cognome, email_verification_token, status 
      FROM users 
      WHERE email = $1
    `;
    
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    
    if (user.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Account già verificato',
        message: 'Il tuo account è già stato verificato'
      });
    }
    
    if (!user.email_verification_token) {
      return res.status(400).json({
        success: false,
        error: 'Token di verifica non disponibile',
        message: 'Contatta il supporto per assistenza'
      });
    }
    
    // Reinvia email di verifica
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/conferma-email?token=${user.email_verification_token}&email=${encodeURIComponent(user.email)}`;
      await emailService.sendVerificationEmail(email, user.email_verification_token, verificationUrl);
      
      console.log('✅ Email di verifica reinviata per:', email);
      
      res.json({
        success: true,
        message: 'Email di verifica reinviata! Controlla la tua casella di posta.'
      });
      
    } catch (emailError) {
      console.error('❌ Errore nell\'invio email di verifica:', emailError);
      
      res.status(500).json({
        success: false,
        error: 'Errore nell\'invio dell\'email di verifica. Riprova più tardi.'
      });
    }
    
  } catch (error) {
    console.error('❌ Errore nel reinvio verifica email:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
