const express = require('express');
const { pool } = require('../../middleware/auth');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const PrivacyErasureLedgerService = require('../../services/privacyErasureLedgerService');

const router = express.Router();

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
