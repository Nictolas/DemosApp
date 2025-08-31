const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../middleware/auth');
const { validateInput, validateEmail } = require('../../middleware/validation');

const router = express.Router();

// Costanti
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// POST /api/auth/login - Login utente
router.post('/login', validateInput(['email', 'password']), validateEmail, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Tentativo login per:', email);
    
    // Cerca l'utente nel database
    const userQuery = `
      SELECT id, nome, cognome, email, password_hash, ruolo, status, 
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
        ruolo: user.ruolo
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login riuscito per:', email);
    
    res.json({
      success: true,
      message: 'Login effettuato con successo',
      token: token,
      user: {
        id: user.id,
        nome: user.nome,
        cognome: user.cognome,
        email: user.email,
        ruolo: user.ruolo,
        status: user.status,
        avatar_config: user.avatar_config
      }
    });
    
  } catch (error) {
    console.error('❌ Errore durante il login:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile completare il login'
    });
  }
});

module.exports = router;
