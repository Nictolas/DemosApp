const express = require('express');
const { pool } = require('../../middleware/auth');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const PrivacyErasureLedgerService = require('../../services/privacyErasureLedgerService');

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
    
    if (user.status !== 'P' && user.status !== 'p') {
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
    if (!userId) {
      return res.status(400).json({ success: false, error: 'ID utente richiesto' });
    }

    const userCheck = await pool.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    const user = userCheck.rows[0];
    if (user.status !== 'P' && user.status !== 'p') {
      return res.status(400).json({
        success: false,
        error: 'Utente non in attesa di approvazione',
        currentStatus: user.status
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await PrivacyErasureLedgerService.recordEvent(client, {
        userId,
        eventType: PrivacyErasureLedgerService.EVENT_TYPES.ACCOUNT_DELETED,
        details: { source: 'admin_reject_pending' }
      });
      const erased = await PrivacyErasureLedgerService.enforceAccountDeletion(client, userId);
      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Utente rifiutato e cancellato completamente',
        user: { id: user.id, email: user.email, status: 'deleted' },
        reason: reason || 'Nessun motivo specificato',
        erased
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore nel rifiuto utente:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// DELETE /api/users/:userId - Elimina utente (solo admin)
router.delete('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(userId) === String(req.userId)) {
      return res.status(400).json({
        success: false,
        error: 'Non puoi eliminare il tuo stesso account'
      });
    }

    const userCheck = await pool.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const user = userCheck.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await PrivacyErasureLedgerService.recordEvent(client, {
        userId,
        eventType: PrivacyErasureLedgerService.EVENT_TYPES.ACCOUNT_DELETED,
        details: { source: 'admin_account_deletion' }
      });
      const erased = await PrivacyErasureLedgerService.enforceAccountDeletion(client, userId);
      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Utente eliminato con successo',
        deletedUser: { id: user.id, email: user.email },
        erased
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore nell\'eliminazione utente:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

module.exports = router;
