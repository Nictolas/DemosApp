const express = require('express');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// POST /api/users/resend-verification-email - Reinvia email di verifica
router.post('/resend-verification-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('📧 POST /api/users/resend-verification-email - Richiesta reinvio verifica per:', email);
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email richiesta'
      });
    }
    
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
    
    if (user.status === 'a') {
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
    
    // Importazione condizionale del servizio email
    let emailService;
    try {
      emailService = require('../../services/emailService');
    } catch (error) {
      console.log('⚠️ Servizio email non disponibile:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Servizio email non disponibile al momento'
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
