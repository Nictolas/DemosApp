const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { auditLog } = require('../../services/auditService');
const { getPool } = require('../../config/database');
const bcrypt = require('bcryptjs');

/**
 * @route DELETE /api/user/delete-account
 * @desc Cancella definitivamente l'account dell'utente
 * @access Private
 * Per utenti con password: richiede password + conferma "CANCELLA".
 * Per utenti solo passkey o solo OAuth: richiede solo conferma "CANCELLA".
 */
router.delete('/', verifyToken, async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { password, confirmText } = req.body;

    if (confirmText !== 'CANCELLA') {
      return res.status(400).json({
        success: false,
        message: 'Testo di conferma non valido. Scrivi esattamente: CANCELLA'
      });
    }

    await client.query('BEGIN');

    const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato'
      });
    }

    const hasPassword = userResult.rows[0].password_hash != null && String(userResult.rows[0].password_hash).trim() !== '';

    if (hasPassword) {
      if (!password) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Password richiesta per confermare la cancellazione'
        });
      }
      const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
      if (!isValidPassword) {
        await client.query('ROLLBACK');
        return res.status(401).json({
          success: false,
          message: 'Password non corretta'
        });
      }
    }

    // Log dell'inizio della cancellazione
    await auditLog({
      userId: userId,
      action: 'ACCOUNT_DELETION_STARTED',
      resource: 'user_account',
      details: {
        timestamp: new Date().toISOString(),
        reason: 'User requested account deletion'
      }
    });

    // Cancella i dati in ordine per rispettare le foreign key constraints
    
    // 1. Cancella le opinioni
    await client.query('DELETE FROM opinioni_risposte WHERE user_id = $1', [userId]);
    
    // 2. Cancella i voti
    await client.query('DELETE FROM voti_capo_stato WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voti_ice WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voti_referendum_abrogativi WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voti_amnistia WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voti_grazia WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voti_iniziative_popolari WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM voti_ministri WHERE user_id = $1', [userId]);
    
    // 3. Cancella le candidature
    await client.query('DELETE FROM candidature_elezioni WHERE user_id = $1', [userId]);
    
    // 4. Cancella le notifiche
    await client.query('DELETE FROM notifiche WHERE user_id = $1', [userId]);
    
    // 5. Cancella i log di audit
    // NOTA: Con Axiom abilitato, i log vengono conservati su Axiom per conformità GDPR
    // Axiom non supporta DELETE diretto di record, quindi i log vengono mantenuti
    // Questo è conforme al GDPR che richiede conservazione dei log per sicurezza
    if (process.env.AXIOM_ENABLED !== 'true') {
      await client.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
    } else {
      console.log(`ℹ️  Log audit per utente ${userId} conservati su Axiom per conformità GDPR`);
    }

    // 6. Cancella l'utente stesso (google_sub, apple_user_id sono colonne in users, eliminate con la riga)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    // Log della cancellazione completata
    await auditLog({
      userId: null, // L'utente non esiste più
      action: 'ACCOUNT_DELETION_COMPLETED',
      resource: 'user_account',
      details: {
        deletedUserId: userId,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: 'Account cancellato con successo'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Errore durante la cancellazione dell\'account:', error);
    
    // Log dell'errore
    await auditLog({
      userId: req.user?.id,
      action: 'ACCOUNT_DELETION_ERROR',
      resource: 'user_account',
      details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    res.status(500).json({
      success: false,
      message: 'Errore interno del server durante la cancellazione dell\'account'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
