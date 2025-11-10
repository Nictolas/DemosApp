const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// POST /api/auth/verify-email - Verifica email con token
router.post('/verify-email', async (req, res) => {
  try {
    console.log('✅ DEBUG: Richiesta verifica email ricevuta!');
    console.log('✅ DEBUG: Headers:', req.headers);
    console.log('✅ DEBUG: Body:', req.body);
    console.log('✅ DEBUG: Query:', req.query);
    
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token mancante',
        message: 'Token di verifica non fornito'
      });
    }
    
    // Verifica il token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token decodificato:', decoded);
    } catch (jwtError) {
      console.error('❌ Errore verifica token:', jwtError);
      return res.status(400).json({
        success: false,
        error: 'Token non valido',
        message: 'Token di verifica non valido o scaduto'
      });
    }
    
    // Verifica che il token sia per la verifica email
    if (decoded.type !== 'email_verification') {
      return res.status(400).json({
        success: false,
        error: 'Token non valido',
        message: 'Tipo di token non corretto'
      });
    }
    
    const email = decoded.email;
    console.log('📧 Verifica email per:', email);
    
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
    
    // Se l'email è già verificata, restituisci successo invece di errore
    if (user.status !== 'p') {
      console.log('✅ Email già verificata per:', email);
      return res.json({
        success: true,
        message: 'La tua email è già stata verificata!',
        alreadyVerified: true,
        user: {
          id: user.id,
          email: user.email,
          status: user.status
        }
      });
    }
    
    // Aggiorna lo status dell'utente a approved
    const updateQuery = 'UPDATE users SET status = $1, email_verified_at = NOW() WHERE id = $2 RETURNING id, email, status';
    const updateResult = await pool.query(updateQuery, ['a', user.id]);
    
    console.log('✅ Utente verificato:', updateResult.rows[0]);
    
    res.json({
      success: true,
      message: 'Email verificata con successo!',
      user: {
        id: updateResult.rows[0].id,
        email: updateResult.rows[0].email,
        status: updateResult.rows[0].status
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica email:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica email',
      message: error.message
    });
  }
});

module.exports = router;
