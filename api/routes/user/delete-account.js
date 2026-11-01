const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');
const { getPool } = require('../../config/database');
const bcrypt = require('bcryptjs');
const PrivacyErasureLedgerService = require('../../services/privacyErasureLedgerService');

/**
 * @route GET /api/user/delete-account/requirements
 * @desc Indica se l'account corrente richiede la password per la cancellazione.
 * @access Private
 */
router.get('/requirements', verifyToken, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato'
      });
    }

    const passwordHash = result.rows[0].password_hash;
    const requiresPassword = passwordHash != null && String(passwordHash).trim() !== '';

    return res.json({
      success: true,
      requiresPassword
    });
  } catch (error) {
    console.error('ACCOUNT_DELETION_REQUIREMENTS_FAILED');
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
});

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

    // La revoca dei topic avviene nel servizio centrale di cancellazione,
    // usato anche da percorsi admin e di riconciliazione, prima del cleanup DB.

    // Un problema del trasporto audit non deve impedire l'esercizio
    // del diritto di cancellazione. L'eventuale mancata consegna va
    // segnalata senza riportare payload o identificativi nel log tecnico.
    try {
      await AuditService.logAction({
        userId,
        action: 'ACCOUNT_DELETION_STARTED',
        resource: 'user_account',
        details: {
          timestamp: new Date().toISOString(),
          reason: 'User requested account deletion'
        }
      });
    } catch {
      console.error('ACCOUNT_DELETION_START_AUDIT_FAILED');
    }

    await PrivacyErasureLedgerService.recordEvent(client, {
      userId,
      eventType: PrivacyErasureLedgerService.EVENT_TYPES.ACCOUNT_DELETED,
      details: { source: 'canonical_account_deletion' }
    });

    // Unico percorso canonico di cancellazione: copre varianti storiche
    // user_id/userid/utente_id, tutte le superfici di voto note, contenuti/social
    // e la verifica CIE pseudonima. Questo evita cancellazioni parziali dipendenti
    // dallo schema specifico del deployment.
    // Mantiene il comportamento storico per il fallback audit locale. La retention
    // provider/Axiom resta disciplinata separatamente da RP-10.
    if (process.env.AXIOM_ENABLED !== 'true') {
      await PrivacyErasureLedgerService.deleteByAnyColumn(
        client,
        'audit_logs',
        ['user_id', 'userid', 'userId'],
        userId
      );
    }

    await PrivacyErasureLedgerService.enforceAccountDeletion(client, userId);

    await client.query('COMMIT');

    // COMMIT gia' confermato: un errore nell'audit esterno non deve
    // trasformare una cancellazione riuscita in una falsa risposta HTTP 500.
    // Non copiare l'ID cancellato nei dettagli del log.
    try {
      await AuditService.logAction({
        userId: null,
        action: 'ACCOUNT_DELETION_COMPLETED',
        resource: 'user_account',
        details: { timestamp: new Date().toISOString() }
      });
    } catch {
      console.error('ACCOUNT_DELETION_COMPLETION_AUDIT_FAILED');
    }

    res.json({
      success: true,
      message: 'Account cancellato con successo'
    });

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      console.error('ACCOUNT_DELETION_ROLLBACK_FAILED');
    }
    // Evita dettagli SQL, identificativi e payload nei log operativi.
    console.error('ACCOUNT_DELETION_FAILED');
    try {
      await AuditService.logAction({
        userId: req.user?.id,
        action: 'ACCOUNT_DELETION_ERROR',
        resource: 'user_account',
        details: { timestamp: new Date().toISOString() },
        success: false,
        errorMessage: 'ACCOUNT_DELETION_FAILED'
      });
    } catch {
      console.error('ACCOUNT_DELETION_ERROR_AUDIT_FAILED');
    }

    res.status(500).json({
      success: false,
      message: 'Errore interno del server durante la cancellazione dell\'account'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
