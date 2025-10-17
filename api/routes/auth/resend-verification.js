const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');

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

// POST /api/auth/resend-verification - Rinvio email di verifica
router.post('/resend-verification', async (req, res) => {
  try {
    console.log('✅ DEBUG: Richiesta rinvio verifica email ricevuta!');
    console.log('✅ DEBUG: Body:', req.body);
    
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email mancante',
        message: 'Indirizzo email non fornito'
      });
    }
    
    console.log('📧 Rinvio verifica email per:', email);
    
    // Trova l'utente nel database
    const userQuery = 'SELECT id, email, status FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Nessun utente trovato con questa email'
      });
    }
    
    const user = userResult.rows[0];
    console.log('👤 Utente trovato:', user);
    
    // Verifica che l'utente sia in stato pending
    if (user.status !== 'P') {
      return res.status(400).json({
        success: false,
        error: 'Email già verificata',
        message: 'Questa email è già stata verificata'
      });
    }
    
    // Genera nuovo token di verifica email (valido per 24 ore)
    const verificationToken = jwt.sign(
      { 
        email: email.toLowerCase(),
        type: 'email_verification'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Aggiorna il token nel database
    const updateTokenQuery = 'UPDATE users SET email_verification_token = $1 WHERE id = $2';
    await pool.query(updateTokenQuery, [verificationToken, user.id]);
    
    console.log('✅ Nuovo token generato per:', email);
    
    // Invia email di verifica
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/verifica-email?token=${verificationToken}`;
      await emailService.sendVerificationEmail(email, verificationToken, verificationUrl);
      
      console.log('✅ Email di verifica rinviata per:', email);
      
      res.json({
        success: true,
        message: 'Email di verifica inviata con successo!'
      });
      
    } catch (emailError) {
      console.error('❌ Errore nell\'invio email di verifica:', emailError);
      
      res.status(500).json({
        success: false,
        error: 'Errore nell\'invio email',
        message: 'Impossibile inviare l\'email di verifica. Riprova più tardi.'
      });
    }
    
  } catch (error) {
    console.error('❌ Errore nel rinvio verifica email:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel rinvio verifica email',
      message: error.message
    });
  }
});

module.exports = router;
