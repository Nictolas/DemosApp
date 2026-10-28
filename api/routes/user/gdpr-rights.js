const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { validateInput } = require('../../middleware/validation');
const { pool } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');
const PrivacyErasureLedgerService = require('../../services/privacyErasureLedgerService');
const { decrypt: decryptEmail } = require('../../utils/emailCrypto');
const { convertToCSV } = require('../../utils/gdprCsv');
// Usa crypto nativo invece di uuid
const crypto = require('crypto');

const router = express.Router();

// Middleware per tutti gli endpoint
router.use(verifyToken);

/**
 * GET /api/user/data-export
 * Diritto di portabilità dei dati (GDPR Art. 20)
 * Esporta tutti i dati personali dell'utente in formato JSON o CSV
 * 
 * Query parameters:
 * - format: 'json' (default) o 'csv'
 */
router.get('/data-export', async (req, res) => {
  try {
    const userId = req.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const format = (req.query.format || 'json').toLowerCase(); // json o csv
    
    // Valida il formato
    if (format !== 'json' && format !== 'csv') {
      return res.status(400).json({
        success: false,
        error: 'Formato non valido. Utilizzare "json" o "csv"'
      });
    }

    // No user identifier in operational logs; the audit service logs access separately.

    // Log dell'accesso ai dati
    await AuditService.logAction({
      userId,
      action: 'DATA_ACCESS',
      resource: 'user_data_export',
      details: { request_type: 'data_export' },
      ipAddress,
      userAgent,
      success: true
    });

    // 1. Recupera dati utente principali (incl. OAuth: google_sub, apple_user_id)
    const userQuery = `
      SELECT
        u.id, u.email, u.nome, u.cognome, u.sesso, u.account_type, u.ruolo, u.status, u.premium, u.created_at, u.updated_at,
        COALESCE(up.data_nascita, u.data_nascita) AS data_nascita,
        COALESCE(up.genere, u.genere) AS genere,
        CASE WHEN up.avatar_config IS NOT NULL THEN up.avatar_config
             WHEN pg_input_is_valid(u.avatar_config, 'jsonb') THEN u.avatar_config::jsonb
             ELSE NULL END AS avatar_config,
        COALESCE(up.cittadinanza, u.cittadinanza) AS cittadinanza,
        COALESCE(up.paese_residenza, u.paese_residenza) AS paese_residenza,
        COALESCE(up.regione_residenza, u.regione_residenza) AS regione_residenza,
        COALESCE(up.provincia_residenza, u.provincia_residenza) AS provincia_residenza,
        COALESCE(up.comune_residenza, u.comune_residenza) AS comune_residenza,
        COALESCE(up.paese_elezione, u.paese_elezione) AS paese_elezione,
        COALESCE(up.regione_elezione, u.regione_elezione) AS regione_elezione,
        COALESCE(up.provincia_elezione, u.provincia_elezione) AS provincia_elezione,
        COALESCE(up.comune_elezione, u.comune_elezione) AS comune_elezione,
        COALESCE(up.grado_elezione, u.grado_elezione) AS grado_elezione,
        COALESCE(up.paese_candidatura, u.paese_candidatura) AS paese_candidatura,
        COALESCE(up.regione_candidatura, u.regione_candidatura) AS regione_candidatura,
        COALESCE(up.provincia_candidatura, u.provincia_candidatura) AS provincia_candidatura,
        COALESCE(up.comune_candidatura, u.comune_candidatura) AS comune_candidatura,
        COALESCE(up.grado_candidatura, u.grado_candidatura) AS grado_candidatura,
        COALESCE(uc.privacy_policy_consent, u.privacy_policy_consent) AS privacy_policy_consent,
        COALESCE(uc.terms_of_service_consent, u.terms_of_service_consent) AS terms_of_service_consent,
        COALESCE(uc.consent_timestamp, u.consent_timestamp) AS consent_timestamp,
        u.consent_ip_address,
        u.consent_user_agent,
        COALESCE(uc.political_opinions_consent, u.political_opinions_consent) AS political_opinions_consent
      FROM users u
      LEFT JOIN user_profile up ON up.user_id = u.id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE u.id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    const userData = userResult.rows[0];
    if (userData.email != null) userData.email = decryptEmail(userData.email);

    // 2. Recupera opinioni politiche
    // Opinions are stored in opinioni_risposte, NOT legacy users columns.
    // Include every answer column (including new questions) without exporting
    // another user's data or duplicating the account identifier.
    const opinionsResult = await pool.query(
      `SELECT to_jsonb(o) - 'user_id' AS opinion_data
       FROM opinioni_risposte o WHERE o.user_id = $1`,
      [userId]
    );
    const opinions = opinionsResult.rows[0]?.opinion_data || {};

    // 3. Recupera voti (anonimizzati per privacy)
    const votesQuery = `
      SELECT 'capo_stato' as vote_type, COUNT(*) as vote_count
      FROM voti_capo_stato WHERE userid = $1
      UNION ALL
      SELECT 'referendum' as vote_type, COUNT(*) as vote_count
      FROM voti_referendum_abrogativi WHERE userid = $1
      UNION ALL
      SELECT 'iniziative' as vote_type, COUNT(*) as vote_count
      FROM voti_iniziative_popolari WHERE userid = $1
      UNION ALL
      SELECT 'ice' as vote_type, COUNT(*) as vote_count
      FROM voti_ice WHERE utente_id = $1
    `;
    
    const votesResult = await pool.query(votesQuery, [userId]);
    const votes = votesResult.rows;

    // 4. Recupera comunicazioni
    const communicationsQuery = `
      SELECT id, titolo, testo, zona, data_creazione, likes, dislikes, punti_trasparenza
      FROM comunicazioni 
      WHERE id_utente = $1
      ORDER BY data_creazione DESC
    `;
    
    const communicationsResult = await pool.query(communicationsQuery, [userId]);
    const communications = communicationsResult.rows;

    // 5. Recupera notifiche
    const notificationsQuery = `
      SELECT id, type, title, message, read, created_at
      FROM user_notifications 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    const notificationsResult = await pool.query(notificationsQuery, [userId]);
    const notifications = notificationsResult.rows;

    // 6. Recupera log di audit dell'utente
    const auditLogs = await AuditService.getUserAuditLogs(userId, { limit: 100 });

    // 6b. Provider OAuth: nuovo schema user_auth_providers + fallback legacy
    const authProvidersResult = await pool.query(
      `SELECT provider, provider_user_id
       FROM user_auth_providers
       WHERE user_id = $1`,
      [userId]
    );
    const authProviders = authProvidersResult.rows || [];

    // 7. Compila il report completo
    const dataExport = {
      export_info: {
        export_date: new Date().toISOString(),
        user_id: userId,
        format_version: '1.1',
        format_schema: 'https://schema.org/Person',
        gdpr_article: 'Art. 20 - Diritto di portabilità dei dati',
        data_categories: [
          'personal_data',
          'auth_providers',
          'political_opinions',
          'voting_activity',
          'communications',
          'notifications',
          'consent_history',
          'audit_logs'
        ],
        note: 'Esportazione delle categorie elencate. La verifica di completezza e portabilità GDPR è ancora in corso.'
      },
      personal_data: {
        basic_info: {
          id: userData.id,
          email: userData.email,
          nome: userData.nome,
          cognome: userData.cognome,
          data_nascita: userData.data_nascita,
          genere: userData.genere,
          sesso: userData.sesso,
          cittadinanza: userData.cittadinanza,
          ruolo: userData.ruolo,
          account_type: userData.account_type,
          avatar_config: userData.avatar_config
        },
        residence_info: {
          paese_residenza: userData.paese_residenza,
          regione_residenza: userData.regione_residenza,
          provincia_residenza: userData.provincia_residenza,
          comune_residenza: userData.comune_residenza
        },
        election_info: {
          paese_elezione: userData.paese_elezione,
          regione_elezione: userData.regione_elezione,
          provincia_elezione: userData.provincia_elezione,
          comune_elezione: userData.comune_elezione,
          grado_elezione: userData.grado_elezione
        },
        candidacy_info: {
          paese_candidatura: userData.paese_candidatura,
          regione_candidatura: userData.regione_candidatura,
          provincia_candidatura: userData.provincia_candidatura,
          comune_candidatura: userData.comune_candidatura,
          grado_candidatura: userData.grado_candidatura
        },
        account_info: {
          status: userData.status,
          premium: userData.premium,
          created_at: userData.created_at,
          updated_at: userData.updated_at
        },
        auth_providers: authProviders.length > 0 ? authProviders : undefined
      },
      political_opinions: opinions,
      voting_activity: {
        vote_counts: votes,
        note: 'I voti specifici non sono inclusi per garantire l\'anonimato del voto'
      },
      communications: communications,
      notifications: notifications,
      consent_history: {
        privacy_policy_consent: userData.privacy_policy_consent,
        terms_of_service_consent: userData.terms_of_service_consent,
        consent_timestamp: userData.consent_timestamp,
        consent_ip_address: userData.consent_ip_address,
        consent_user_agent: userData.consent_user_agent,
        political_opinions_consent: userData.political_opinions_consent
      },
      audit_logs: auditLogs,
      data_retention_info: {
        note: 'Le tempistiche di conservazione dipendono dalla policy vigente; verificare il registro GDPR ufficiale.'
      }
    };

    // 8. Registra la richiesta di esportazione
    const requestQuery = `
      INSERT INTO user_rights_requests (user_id, request_type, request_data, status)
      VALUES ($1, $2, $3, 'completed')
      RETURNING id
    `;
    
    await pool.query(requestQuery, [
      userId,
      'data_export',
      JSON.stringify({ export_date: dataExport.export_info.export_date, format })
    ]);

    // 9. Restituisci i dati nel formato richiesto
    if (format === 'csv') {
      const csv = convertToCSV(dataExport);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dati-personali-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\ufeff' + csv); // BOM UTF-8 per Excel
    } else {
      res.json({
        success: true,
        data: dataExport,
        message: 'Esportazione dati completata con successo'
      });
    }

  } catch (error) {
    console.error('❌ Errore nell\'esportazione dati:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: req.userId,
      action: 'DATA_ACCESS',
      resource: 'user_data_export',
      details: { request_type: 'data_export' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante l\'esportazione dei dati'
    });
  }
});

/**
 * DELETE /api/user/account
 * Diritto di cancellazione (GDPR Art. 17)
 * Cancella l'account e tutti i dati associati
 */
router.delete('/account', validateInput(['confirmation']), async (req, res) => {
  if (req.body?.confirmation !== 'CONFERMO_CANCELLAZIONE_ACCOUNT') {
    return res.status(400).json({
      success: false,
      error: 'Conferma di cancellazione non valida'
    });
  }

  const userId = req.userId;
  let client;
  let committed = false;
  try {
    // A transaction must use ONE checked-out client. Calling pool.query('BEGIN')
    // does not reserve the same connection for subsequent pool.query calls.
    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT id FROM users WHERE id::text = $1 FOR UPDATE',
      [String(userId)]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    // Preserve the existing rights-request receipt for DPO/legal retention
    // review; never erase it here as part of account erasure.
    const request = await client.query(
      `INSERT INTO user_rights_requests (user_id, request_type, request_data, status)
       VALUES ($1, 'data_erasure', $2::jsonb, 'processing')
       RETURNING id`,
      [String(userId), JSON.stringify({ confirmation: true })]
    );

    await PrivacyErasureLedgerService.recordEvent(client, {
      userId,
      eventType: PrivacyErasureLedgerService.EVENT_TYPES.ACCOUNT_DELETED,
      details: { source: 'gdpr_rights_account_deletion' }
    });

    if (process.env.AXIOM_ENABLED !== 'true') {
      await PrivacyErasureLedgerService.deleteByAnyColumn(
        client, 'audit_logs', ['user_id', 'userid', 'userId'], userId
      );
    }

    const result = await PrivacyErasureLedgerService.enforceAccountDeletion(client, userId);
    if (result.userDeleted !== 1) {
      throw new Error('Account deletion did not remove exactly one account');
    }

    await client.query(
      `UPDATE user_rights_requests
       SET status = 'completed', processed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [request.rows[0].id]
    );
    await client.query('COMMIT');
    committed = true;
  } catch (error) {
    if (client && !committed) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Rollback cancellazione GDPR non riuscito');
      }
    }
    console.error('Cancellazione GDPR fallita');
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server durante la cancellazione dell\'account'
    });
  } finally {
    if (client) client.release();
  }

  // External audit is best-effort AFTER the transaction; its availability must
  // not turn a successfully committed erasure into a 500 response.
  try {
    await AuditService.logAction({
      userId: null,
      action: 'DATA_DELETE_REQUEST',
      resource: 'user_account',
      details: { request_type: 'account_deletion', completed: true },
      success: true
    });
  } catch (auditError) {
    console.error('Audit cancellazione GDPR non disponibile');
  }

  return res.json({
    success: true,
    message: 'Account e dati associati cancellati con successo',
    deletion_date: new Date().toISOString()
  });
});

/**
 * PUT /api/user/limit-processing
 * Diritto di limitazione del trattamento (GDPR Art. 18)
 * Limita il trattamento di specifiche categorie di dati
 */
router.put('/limit-processing', validateInput(['limited', 'categories']), async (req, res) => {
  try {
    const userId = req.userId;
    const { limited, categories, reason } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    console.log(`🔒 Richiesta limitazione trattamento per utente: ${userId}`);

    // Valida le categorie
    const validCategories = [
      'personal_data', 'political_opinions', 'voting_data', 
      'communication_data', 'technical_data', 'marketing_data'
    ];
    
    const invalidCategories = categories.filter(cat => !validCategories.includes(cat));
    if (invalidCategories.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Categorie non valide: ${invalidCategories.join(', ')}`
      });
    }

    // Imposta le limitazioni
    const result = await AuditService.setProcessingLimits(
      userId, 
      limited, 
      categories, 
      reason
    );

    // Registra la richiesta
    const requestQuery = `
      INSERT INTO user_rights_requests (user_id, request_type, request_data, status)
      VALUES ($1, $2, $3, 'completed')
      RETURNING id
    `;
    
    await pool.query(requestQuery, [
      userId,
      'limit_processing',
      JSON.stringify({ 
        limited, 
        categories, 
        reason,
        request_date: new Date().toISOString()
      })
    ]);

    res.json({
      success: true,
      message: limited ? 'Limitazioni di trattamento applicate' : 'Limitazioni di trattamento rimosse',
      data: result
    });

  } catch (error) {
    console.error('❌ Errore nella limitazione trattamento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante la limitazione del trattamento'
    });
  }
});

/**
 * POST /api/user/object
 * Diritto di opposizione al trattamento (GDPR Art. 21)
 * Oppone al trattamento per motivi legittimi
 */
router.post('/object', validateInput(['reason', 'categories']), async (req, res) => {
  try {
    const userId = req.userId;
    const { reason, categories } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    console.log(`🚫 Richiesta opposizione trattamento per utente: ${userId}`);

    // Valida le categorie
    const validCategories = [
      'personal_data', 'political_opinions', 'voting_data', 
      'communication_data', 'technical_data'
    ];
    
    const invalidCategories = categories.filter(cat => !validCategories.includes(cat));
    if (invalidCategories.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Categorie non valide: ${invalidCategories.join(', ')}`
      });
    }

    // Registra l'opposizione
    const requestQuery = `
      INSERT INTO user_rights_requests (user_id, request_type, request_data, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
    `;
    
    const requestResult = await pool.query(requestQuery, [
      userId,
      'object_processing',
      JSON.stringify({ 
        reason, 
        categories,
        request_date: new Date().toISOString()
      })
    ]);

    const requestId = requestResult.rows[0].id;

    // Log dell'opposizione
    await AuditService.logAction({
      userId,
      action: 'PROCESSING_OBJECTION',
      resource: 'user_rights_requests',
      resourceId: requestId,
      details: { reason, categories },
      ipAddress,
      userAgent,
      success: true
    });

    res.json({
      success: true,
      message: 'Opposizione al trattamento registrata. Verrà esaminata entro 30 giorni.',
      request_id: requestId
    });

  } catch (error) {
    console.error('❌ Errore nell\'opposizione trattamento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante la registrazione dell\'opposizione'
    });
  }
});

/**
 * GET /api/user/rights-requests
 * Ottiene lo stato delle richieste diritti GDPR dell'utente
 */
router.get('/rights-requests', async (req, res) => {
  try {
    const userId = req.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, request_type, status, request_data, response_data, 
             created_at, processed_at, processed_by
      FROM user_rights_requests 
      WHERE user_id = $1
    `;
    
    const values = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recupero richieste diritti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
