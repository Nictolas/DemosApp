const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');
const PrivacyErasureLedgerService = require('../../services/privacyErasureLedgerService');
const { cleanupConsentScopedPoliticalData } = require('../../services/politicalConsentService');

// Consent state and its metadata are personal information. Apply this before
// verifyToken so 401/403/500 responses cannot be cached either.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
});

/**
 * GET /api/user/political-opinions-consent
 * Verifica lo stato del consenso alle opinioni politiche
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    const query = `
      SELECT 
        COALESCE(uc.political_opinions_consent, u.political_opinions_consent) AS political_opinions_consent,
        COALESCE(uc.political_opinions_consent_timestamp, u.political_opinions_consent_timestamp) AS political_opinions_consent_timestamp
      FROM public.users u
      LEFT JOIN public.user_consents uc ON uc.user_id = u.id
      WHERE u.id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const userData = result.rows[0];
    
    res.json({
      success: true,
      consent: {
        granted: userData.political_opinions_consent || false,
        // IP and user-agent are retained, when needed, only in the consent
        // evidence store. They are unnecessary for this UI response.
        timestamp: userData.political_opinions_consent_timestamp
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica consenso opinioni politiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

/**
 * POST /api/user/political-opinions-consent
 * Salva il consenso esplicito alle opinioni politiche (GDPR Art. 9)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { consent } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    if (typeof consent !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Il campo consent deve essere un booleano'
      });
    }
    
    // Se il consenso è false, restituisci errore (la revoca va fatta tramite PUT /revoke)
    if (!consent) {
      return res.status(400).json({
        success: false,
        error: 'Per revocare il consenso, utilizza l\'endpoint PUT /api/user/political-opinions-consent/revoke'
      });
    }
    
    // Salva il consenso esplicito
    const updateQuery = `
      UPDATE public.users
      SET 
        political_opinions_consent = $1,
        political_opinions_consent_timestamp = NOW(),
        political_opinions_consent_ip_address = $2,
        political_opinions_consent_user_agent = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING 
        political_opinions_consent,
        political_opinions_consent_timestamp
    `;
    
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(updateQuery, [
        true,
        ipAddress,
        userAgent,
        userId
      ]);

      if (result.rows.length > 0) {
        await client.query(
          `INSERT INTO public.user_consents (
            user_id, political_opinions_consent, political_opinions_consent_timestamp,
            political_opinions_consent_ip_address, political_opinions_consent_user_agent
          ) VALUES ($1, true, NOW(), $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET
            political_opinions_consent = true,
            political_opinions_consent_timestamp = NOW(),
            political_opinions_consent_ip_address = EXCLUDED.political_opinions_consent_ip_address,
            political_opinions_consent_user_agent = EXCLUDED.political_opinions_consent_user_agent,
            updated_at = NOW()`,
          [userId, ipAddress, userAgent]
        );
      }
      if (result.rows.length > 0) {
        await PrivacyErasureLedgerService.recordEvent(client, {
          userId,
          eventType: PrivacyErasureLedgerService.EVENT_TYPES.POLITICAL_CONSENT_GRANTED,
          details: { source: 'political_opinions_consent' }
        });
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    // Log dell'azione
    await AuditService.logAction({
      userId,
      action: 'POLITICAL_OPINIONS_CONSENT_GRANTED',
      resource: 'user_consent',
      details: {
        consent_type: 'political_opinions',
        gdpr_article: '9.2.a',
        ip_address: ipAddress,
        user_agent: userAgent
      },
      ipAddress,
      userAgent,
      success: true
    });
    
    console.log(`✅ Consenso opinioni politiche concesso per utente: ${userId}`);
    
    res.json({
      success: true,
      message: 'Consenso alle opinioni politiche salvato con successo',
      consent: {
        granted: true,
        timestamp: result.rows[0].political_opinions_consent_timestamp
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvataggio consenso opinioni politiche:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: req.userId,
      action: 'POLITICAL_OPINIONS_CONSENT_GRANTED',
      resource: 'user_consent',
      details: { consent_type: 'political_opinions' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante il salvataggio del consenso'
    });
  }
});

/**
 * PUT /api/user/political-opinions-consent/revoke
 * Revoca il consenso alle opinioni politiche
 */
router.put('/revoke', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Revoca il consenso
    const updateQuery = `
      UPDATE public.users
      SET 
        political_opinions_consent = false,
        political_opinions_consent_timestamp = NULL,
        political_opinions_consent_ip_address = NULL,
        political_opinions_consent_user_agent = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    
    const client = await pool.connect();
    let result;
    let cleanupResult = { totalDeleted: 0, deletedByTable: {} };
    try {
      await client.query('BEGIN');
      result = await client.query(updateQuery, [userId]);
      if (result.rows.length > 0) {
        await client.query(
          `INSERT INTO public.user_consents (
            user_id, political_opinions_consent, political_opinions_consent_timestamp,
            political_opinions_consent_ip_address, political_opinions_consent_user_agent
          ) VALUES ($1, false, NULL, NULL, NULL)
          ON CONFLICT (user_id) DO UPDATE SET
            political_opinions_consent = false,
            political_opinions_consent_timestamp = NULL,
            political_opinions_consent_ip_address = NULL,
            political_opinions_consent_user_agent = NULL,
            updated_at = NOW()`,
          [userId]
        );

        // La revoca e la cancellazione di tutti i dati politici generati dall'utente
        // che dipendono da questo consenso devono essere atomiche. I voti
        // istituzionali importati da fonti pubbliche non fanno parte di questo cleanup.
        cleanupResult = await cleanupConsentScopedPoliticalData(client, userId);
      }
      if (result.rows.length > 0) {
        await PrivacyErasureLedgerService.recordEvent(client, {
          userId,
          eventType: PrivacyErasureLedgerService.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
          details: {
            source: 'political_opinions_consent',
            political_records_deleted_count: cleanupResult.totalDeleted,
            deleted_by_table: cleanupResult.deletedByTable,
            legacy_opinion_columns_cleared_count: cleanupResult.legacyOpinionColumnsCleared,
            proposal_links_cleared_count: cleanupResult.proposalLinksCleared,
            legacy_selections_cleared_count: cleanupResult.legacySelectionsCleared
          }
        });
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    if (cleanupResult.totalDeleted > 0) {
      console.log(`✅ ${cleanupResult.totalDeleted} record politici generati dall'utente eliminati durante la revoca`);
    } else {
      console.log('ℹ️ Nessun dato politico generato dall\'utente da eliminare durante la revoca');
    }
    
    // Log dell'azione
    await AuditService.logAction({
      userId,
      action: 'POLITICAL_OPINIONS_CONSENT_REVOKED',
      resource: 'user_consent',
      details: {
        consent_type: 'political_opinions',
        gdpr_article: '9.2.a',
        political_cleanup_completed: true,
        political_records_deleted_count: cleanupResult.totalDeleted,
        deleted_by_table: cleanupResult.deletedByTable,
        legacy_opinion_columns_cleared_count: cleanupResult.legacyOpinionColumnsCleared,
        proposal_links_cleared_count: cleanupResult.proposalLinksCleared
      },
      ipAddress,
      userAgent,
      success: true
    });
    
    console.log(`✅ Consenso opinioni politiche revocato per utente: ${userId}`);
    
    res.json({
      success: true,
      message: 'Consenso politico revocato con successo. I dati politici generati da te e dipendenti da questo consenso sono stati eliminati.',
      consent: {
        granted: false,
        timestamp: null
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nella revoca consenso opinioni politiche:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: req.userId,
      action: 'POLITICAL_OPINIONS_CONSENT_REVOKED',
      resource: 'user_consent',
      details: { consent_type: 'political_opinions' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante la revoca del consenso'
    });
  }
});

module.exports = router;

