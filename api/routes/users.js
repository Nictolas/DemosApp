const express = require('express');
const { verifyToken, requireAdmin, requireOwnProfile } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/utenti/me - Ottieni dati utente corrente
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log('🔍 DEBUG - Richiesta dati utente corrente per ID:', userId);
    
    const query = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita, 
             regione_residenza, provincia_residenza, comune_residenza, avatar_config, premium,
             created_at, updated_at, status, email_verified
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    const isAdmin = user.ruolo === 'Admin';
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.nome,
        cognome: user.cognome,
        email: user.email,
        ruolo: user.ruolo,
        genere: user.genere,
        data_nascita: user.data_nascita,
        isAdmin: isAdmin
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare dati utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare dati utente'
    });
  }
});

// POST /api/utenti/me/avatar - Aggiorna avatar utente corrente
router.post('/me/avatar', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { avatar_config } = req.body;
    
    if (!avatar_config) {
      return res.status(400).json({
        success: false,
        error: 'Configurazione avatar richiesta'
      });
    }
    
    console.log('🎨 DEBUG - Aggiornamento avatar per utente:', userId);
    
    // Aggiorna l'avatar nel database
    const updateQuery = `
      UPDATE users 
      SET avatar_config = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, nome, cognome, avatar_config
    `;
    
    const result = await pool.query(updateQuery, [JSON.stringify(avatar_config), userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    
    console.log('✅ Avatar aggiornato con successo per utente:', updatedUser.email);
    
    res.json({
      success: true,
      message: 'Avatar aggiornato con successo',
      user: {
        id: updatedUser.id,
        nome: updatedUser.nome,
        cognome: updatedUser.cognome,
        avatar_config: updatedUser.avatar_config
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento avatar'
    });
  }
});

// GET /api/utenti - Ottieni utenti per gestione (solo admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/utenti - Richiesta ricevuta da utente:', req.userId, 'con ruolo:', req.userRole);
    
    const query = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita, created_at, status
      FROM users 
      WHERE status != 'pending'
      ORDER BY nome, cognome
    `;
    
    console.log('🔍 DEBUG /api/utenti - Eseguendo query:', query);
    const result = await pool.query(query);
    console.log('🔍 DEBUG /api/utenti - Query result:', result.rows.length, 'utenti trovati');
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare utenti'
    });
  }
});

// GET /api/utenti/pending - Ottieni utenti in attesa (solo admin)
router.get('/pending', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/utenti/pending - Richiesta ricevuta da utente:', req.userId, 'con ruolo:', req.userRole);
    
    const query = `
      SELECT id, nome, cognome, email, ruolo, genere, data_nascita
      FROM users 
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `;
    
    console.log('🔍 DEBUG /api/utenti/pending - Eseguendo query:', query);
    const result = await pool.query(query);
    console.log('🔍 DEBUG /api/utenti/pending - Query result:', result.rows.length, 'utenti in attesa trovati');
    
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare utenti in attesa:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare utenti in attesa'
    });
  }
});

// POST /api/utenti/approve - Approva utente (solo admin)
router.post('/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    console.log('✅ APPROVAZIONE - Tentativo approvazione utente:', userId);
    
    // Verifica che l'utente esista e abbia status pending
    const userQuery = 'SELECT id, nome, cognome, email, status FROM users WHERE id = $1 AND status = $2';
    const userResult = await pool.query(userQuery, [userId, 'pending']);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato o già approvato'
      });
    }
    
    const user = userResult.rows[0];
    
    // Aggiorna lo status dell'utente da 'pending' a 'approved'
    await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      ['approved', userId]
    );
    
    console.log('✅ Utente approvato con successo:', user.email);
    
    res.json({
      success: true,
      message: `Utente ${user.nome} ${user.cognome} approvato con successo`
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'approvazione utente:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore nell\'approvazione utente',
      message: error.message
    });
  }
});

// POST /api/utenti/reject - Rifiuta utente (solo admin)
router.post('/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    console.log('❌ RIFIUTO - Tentativo rifiuto utente:', userId);
    
    // Verifica che l'utente esista e abbia status pending
    const userQuery = 'SELECT id, nome, cognome, email, status FROM users WHERE id = $1 AND status = $2';
    const userResult = await pool.query(userQuery, [userId, 'pending']);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato o già gestito'
      });
    }
    
    const user = userResult.rows[0];
    
    // Aggiorna lo status dell'utente da 'pending' a 'rejected'
    await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      ['rejected', userId]
    );
    
    console.log('❌ Utente rifiutato con successo:', user.email);
    
    res.json({
      success: true,
      message: `Utente ${user.nome} ${user.cognome} rifiutato`
    });
    
  } catch (error) {
    console.error('❌ Errore nel rifiuto utente:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore nel rifiuto utente',
      message: error.message
    });
  }
});

// DELETE /api/utenti/:userId - Elimina utente (solo admin)
router.delete('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    console.log('🗑️ ELIMINAZIONE - Tentativo eliminazione utente:', userId);
    
    // Verifica che l'utente esista
    const userQuery = 'SELECT id, nome, cognome, email, status FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    
    // Elimina l'utente
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    
    console.log('🗑️ Utente eliminato con successo:', user.email);
    
    res.json({
      success: true,
      message: `Utente ${user.nome} ${user.cognome} eliminato con successo`
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione utente:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione utente',
      message: error.message
    });
  }
});

// Endpoint per reinviare email di conferma manualmente
router.post('/resend-verification-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email richiesta'
      });
    }
    
    console.log('📧 RINVIO EMAIL - Tentativo invio email di conferma per:', email);
    
    // Verifica se l'utente esiste e ha status pending
    const userQuery = 'SELECT id, nome, cognome, email_verification_token FROM users WHERE email = $1 AND status = $2';
    const userResult = await pool.query(userQuery, [email, 'pending']);
    
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
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      
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
    const { sendVerificationEmail } = require('../services/emailService');
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://www.demos.community'}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(email, verificationToken, verificationUrl);
    
    console.log('✅ Email di verifica reinviata con successo per:', email);
    
    res.json({
      success: true,
      message: 'Email di conferma reinviata con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel reinvio email di verifica:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore nel reinvio email di verifica',
      message: error.message
    });
  }
});

module.exports = router;
