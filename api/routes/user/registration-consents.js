const express = require('express');
const router = express.Router();
const { verifyToken, pool } = require('../../middleware/auth');

/**
 * PUT /api/user/registration-consents
 * Salva i consensi accettati durante la registrazione (privacy policy e termini di servizio).
 * 
 * Nota: il consenso alle opinioni politiche (Art. 9) continua a essere gestito
 * dall'endpoint dedicato /api/user/political-opinions-consent, perché richiede
 * anche IP e user agent come prova esplicita.
 */
router.put('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      privacy_policy_consent,
      terms_of_service_consent
    } = req.body || {};

    // Valida input: accettiamo solo booleani; se non arriva niente, errore
    const hasPrivacy = typeof privacy_policy_consent === 'boolean';
    const hasTerms = typeof terms_of_service_consent === 'boolean';

    if (!hasPrivacy && !hasTerms) {
      return res.status(400).json({
        success: false,
        error: 'Nessun consenso valido fornito',
        message: 'Specifica almeno privacy_policy_consent o terms_of_service_consent come booleani.'
      });
    }

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (hasPrivacy) {
      updateFields.push(`privacy_policy_consent = $${paramIndex}`);
      values.push(privacy_policy_consent);
      paramIndex++;
    }

    if (hasTerms) {
      updateFields.push(`terms_of_service_consent = $${paramIndex}`);
      values.push(terms_of_service_consent);
      paramIndex++;
    }

    // Aggiorna consent_timestamp se almeno uno dei consensi è true
    const anyTrue = (hasPrivacy && privacy_policy_consent) || (hasTerms && terms_of_service_consent);
    if (anyTrue) {
      updateFields.push(`consent_timestamp = NOW()`);
    }

    updateFields.push(`updated_at = NOW()`);

    const userIdParamIndex = paramIndex;
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${userIdParamIndex}
      RETURNING id, privacy_policy_consent, terms_of_service_consent, consent_timestamp
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    const updated = result.rows[0];

    res.json({
      success: true,
      data: {
        privacy_policy_consent: updated.privacy_policy_consent,
        terms_of_service_consent: updated.terms_of_service_consent,
        consent_timestamp: updated.consent_timestamp
      }
    });
  } catch (error) {
    console.error('❌ Errore in PUT /api/user/registration-consents:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile aggiornare i consensi di registrazione'
    });
  }
});

module.exports = router;

