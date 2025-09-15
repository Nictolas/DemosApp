const express = require('express');
const { pool } = require('../../middleware/auth');
const { verifyToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// POST /api/users/approve - Approva utente (solo admin)
router.post('/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('✅ POST /api/users/approve - Approvazione utente:', userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    // Verifica che l'utente esista e sia in attesa
    const userCheck = await pool.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userCheck.rows[0];
    
    if (user.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Utente non in attesa di approvazione',
        currentStatus: user.status
      });
    }
    
    // Approva l'utente
    const result = await pool.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, status',
      ['active', userId]
    );
    
    console.log('✅ Utente approvato:', user.email);
    
    res.json({
      success: true,
      message: 'Utente approvato con successo',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        status: result.rows[0].status
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'approvazione utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/users/reject - Rifiuta utente (solo admin)
router.post('/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId, reason } = req.body;
    
    console.log('❌ POST /api/users/reject - Rifiuto utente:', userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    // Verifica che l'utente esista e sia in attesa
    const userCheck = await pool.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userCheck.rows[0];
    
    if (user.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Utente non in attesa di approvazione',
        currentStatus: user.status
      });
    }
    
    // Elimina completamente l'utente rifiutato
    const deleteResult = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [userId]
    );
    
    console.log('🗑️ Utente eliminato completamente:', user.email, 'Motivo:', reason || 'Nessun motivo specificato');
    
    res.json({
      success: true,
      message: 'Utente rifiutato e eliminato completamente dal database',
      user: {
        id: deleteResult.rows[0].id,
        email: deleteResult.rows[0].email,
        status: 'deleted'
      },
      reason: reason || 'Nessun motivo specificato'
    });
    
  } catch (error) {
    console.error('❌ Errore nel rifiuto utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// DELETE /api/users/:userId - Elimina utente (solo admin)
router.delete('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🗑️ DELETE /api/users/:userId - Eliminazione utente:', userId);
    
    // Verifica che l'utente esista
    const userCheck = await pool.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userCheck.rows[0];
    
    // Verifica che non sia l'utente corrente
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Non puoi eliminare il tuo stesso account'
      });
    }
    
    // Elimina l'utente
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [userId]
    );
    
    console.log('🗑️ Utente eliminato:', user.email);
    
    res.json({
      success: true,
      message: 'Utente eliminato con successo',
      deletedUser: {
        id: result.rows[0].id,
        email: result.rows[0].email
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
