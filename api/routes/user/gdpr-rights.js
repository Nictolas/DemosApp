const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { validateInput } = require('../../middleware/validation');
const { pool } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');
const { decrypt: decryptEmail } = require('../../utils/emailCrypto');
// Usa crypto nativo invece di uuid
const crypto = require('crypto');
const { convertToCSV } = require('../../services/gdprCsvExport');
const {parseRightsHistoryQuery, readRightsHistory} = require('../../services/gdprRightsHistoryService');

const router = express.Router();

// This router is mounted before the other /api/user routers. Protect the
// request-history alias here too: authentication may reject it before its
// own router is reached. Do not alter cache policy for unrelated user APIs.
router.use([
  '/data-export', '/account', '/limit-processing', '/object',
  '/rights-requests', '/gdpr-requests'
], (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  next();
});

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
        u.id, u.email, u.nome, u.cognome, u.ruolo, u.status, u.premium, u.created_at, u.updated_at,
        COALESCE(up.data_nascita, u.data_nascita) AS data_nascita,
        COALESCE(up.genere, u.genere) AS genere,
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
    const opinionsQuery = `
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia,
             eutanasia, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia
      FROM users 
      WHERE id = $1
    `;
    
    const opinionsResult = await pool.query(opinionsQuery, [userId]);
    const opinions = opinionsResult.rows[0] || {};

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
      FROM voti_ice WHERE userid = $1
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
        format_version: '1.0',
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
        note: 'I dati sono esportati in formato strutturato, comunemente usato e leggibile automaticamente, conforme al GDPR Art. 20.1'
      },
      personal_data: {
        basic_info: {
          id: userData.id,
          email: userData.email,
          nome: userData.nome,
          cognome: userData.cognome,
          data_nascita: userData.data_nascita,
          genere: userData.genere,
          cittadinanza: userData.cittadinanza,
          ruolo: userData.ruolo
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
        consent_user_agent: userData.consent_user_agent
      },
      audit_logs: auditLogs,
      data_retention_info: {
        account_data: 'Conservato fino alla cancellazione dell\'account',
        voting_data: 'Conservato in forma anonima per 5 anni',
        communication_data: 'Conservato per 3 anni dall\'ultima interazione',
        technical_data: 'Conservato per 12 mesi per sicurezza e debugging'
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
      res.setHeader('Content-Disposition', `attachment; filename="dati-personali-${userId}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\ufeff' + csv); // BOM UTF-8 per Excel
    } else {
      res.json({
        success: true,
        data: dataExport,
        message: 'Esportazione dati completata con successo'
      });
    }

  } catch (error) {
    console.error('GDPR_DATA_EXPORT_FAILED', error?.code || 'QUERY_FAILED');
    
    // Log dell'errore
    try {
      await AuditService.logAction({
        userId: req.userId,
        action: 'DATA_ACCESS',
        resource: 'user_data_export',
        details: { request_type: 'data_export' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        errorMessage: 'GDPR_DATA_EXPORT_FAILED'
      });
    } catch (_) {
      // Secondary audit delivery must not prevent the error response or
      // turn an export failure into an unhandled rejected route promise.
      console.error('GDPR_DATA_EXPORT_SECONDARY_AUDIT_UNAVAILABLE');
    }

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
// The old deletion endpoint used pool.query('BEGIN') across pooled connections,
// bypassed password verification and never recorded the GDPR erasure ledger.
// It cannot safely forward the old confirmation-only payload to the canonical
// route, which requires stronger proof. Fail closed without touching any data.
router.delete('/account', (_req, res) => res.status(410).json({
  success: false,
  error: 'Percorso di cancellazione obsoleto. Usa la cancellazione account dalle Impostazioni.',
  canonical_path: '/api/user/delete-account'
}));

/**
 * PUT /api/user/limit-processing
 * Diritto di limitazione del trattamento (GDPR Art. 18)
 * Limita il trattamento di specifiche categorie di dati
 */
router.put('/limit-processing', validateInput(['limited']), async (req, res) => {
  const userId = req.userId || req.user?.id;
  const { limited, categories, reason = null } = req.body || {};
  const validCategories = new Set([
    'personal_data', 'political_opinions', 'voting_data',
    'communication_data', 'technical_data', 'marketing_data'
  ]);
  if (!userId || typeof limited !== 'boolean' ||
      !Array.isArray(categories) || (limited && categories.length === 0) ||
      categories.length > validCategories.size ||
      categories.some(cat => typeof cat !== 'string' || !validCategories.has(cat)) ||
      new Set(categories).size !== categories.length ||
      (reason !== null && (typeof reason !== 'string' || reason.length > 1000))) {
    return res.status(400).json({
      success: false, error: 'Parametri della limitazione non validi'
    });
  }

  // A retry with the SAME Idempotency-Key must never apply an old
  // restriction again after a newer user action. A conflicting receipt is
  // resolved ONLY after rolling back the whole processing-limit update.
  // Legacy clients without this header retain their existing semantics.
  const header = req.headers?.['idempotency-key'];
  if (header !== undefined && (
    typeof header !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(header)
  )) {
    return res.status(400).json({
      success: false, error: 'Idempotency-Key non valida: serve un UUID v4'
    });
  }
  const requestId = header === undefined ? crypto.randomUUID() : header.toLowerCase();
  const receiptPayload = { limited, categories, reason };
  let client;
  let inTransaction = false;
  let applied;
  let receipt;
  let replay = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;
    const updated = await client.query(
      'INSERT INTO public.data_processing_limits ' +
      '(user_id, processing_limited, limited_categories, reason) ' +
      'VALUES ($1, $2, $3, $4) ' +
      'ON CONFLICT (user_id) DO UPDATE SET ' +
      'processing_limited = EXCLUDED.processing_limited, ' +
      'limited_categories = EXCLUDED.limited_categories, ' +
      'reason = EXCLUDED.reason, updated_at = CURRENT_TIMESTAMP ' +
      'RETURNING *',
      [userId, limited, categories, reason]
    );
    applied = updated.rows?.[0];
    if (updated.rowCount !== 1 || !applied?.id ||
        applied.processing_limited !== limited) {
      throw Error('GDPR_PROCESSING_LIMIT_NOT_CONFIRMED');
    }
    const recorded = await client.query(
      'INSERT INTO public.user_rights_requests ' +
      '(id, user_id, request_type, request_data, status) ' +
      "VALUES ($1::uuid, $2, 'limit_processing', $3::jsonb, 'completed') " +
      'ON CONFLICT (id) DO NOTHING ' +
      'RETURNING id, user_id, request_type, status',
      [requestId, userId, JSON.stringify({
        ...receiptPayload, request_date: new Date().toISOString()
      })]
    );
    if (recorded.rowCount === 0 && recorded.rows?.length === 0) {
      // The UPDATE above MUST NOT survive a repeated or colliding key.
      // PostgreSQL's unique constraint waits for an in-flight winner.
      await client.query('ROLLBACK');
      inTransaction = false;
      replay = true;
    } else {
      receipt = recorded.rows?.[0];
      if (recorded.rowCount !== 1 || !receipt?.id ||
          String(receipt.user_id) !== String(userId) ||
          receipt.request_type !== 'limit_processing' ||
          receipt.status !== 'completed' ||
          String(receipt.id).toLowerCase() !== requestId) {
        throw Error('GDPR_PROCESSING_RIGHTS_RECEIPT_NOT_CONFIRMED');
      }
      await client.query('COMMIT');
      inTransaction = false;
    }
  } catch (error) {
    if (inTransaction && client) {
      try { await client.query('ROLLBACK'); }
      catch (_) { /* The operation remains unconfirmed. */ }
    }
    console.error('Errore nella limitazione trattamento:',
      error?.code || 'QUERY_FAILED');
    return res.status(503).json({
      success: false,
      error: 'Modifica non confermata. Controlla lo stato delle richieste prima di riprovare.'
    });
  } finally {
    if (client) client.release();
  }

  if (replay) {
    // A previous receipt proves that a particular request was committed,
    // not that its restriction remains the CURRENT setting. Never return
    // the rolled-back "applied" row as if it were the current state.
    try {
      const previous = await pool.query(
        'SELECT id, status FROM public.user_rights_requests ' +
        "WHERE id=$1::uuid AND user_id=$2 AND request_type='limit_processing' " +
        "AND request_data - 'request_date' = $3::jsonb LIMIT 1",
        [requestId, userId, JSON.stringify(receiptPayload)]
      );
      const stored = previous.rows?.[0];
      if (!stored?.id) {
        return res.status(409).json({
          success: false, error: 'Chiave già utilizzata o richiesta non verificabile'
        });
      }
      return res.json({
        success: true, replayed: true,
        message: 'Richiesta già registrata. Verifica lo stato attuale delle limitazioni.',
        request_id: stored.id, request_status: stored.status, data: null
      });
    } catch (error) {
      console.error('GDPR_PROCESSING_LIMIT_RETRY_LOOKUP_FAILED',
        error?.code || 'QUERY_FAILED');
      return res.status(503).json({
        success: false, error: 'Ricevuta non verificabile. Controlla lo storico prima di riprovare.'
      });
    }
  }

  // Delivering secondary audit logs cannot turn a committed receipt into
  // a false HTTP failure that could cause an unsafe retry.
  try {
    await AuditService.logAction({
      userId,
      action: limited ? 'PROCESSING_LIMITED' : 'PROCESSING_UNLIMITED',
      resource: 'data_processing_limits',
      resourceId: applied.id,
      details: { limited, categories },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get?.('User-Agent'),
      success: true
    });
  } catch (_) {
    console.error('GDPR_PROCESSING_LIMIT_SECONDARY_AUDIT_UNAVAILABLE');
  }
  return res.json({
    success: true,
    message: limited ? 'Limitazioni di trattamento applicate' :
      'Limitazioni di trattamento rimosse',
    request_id: receipt.id, data: applied
  });
});

/**
 * POST /api/user/object
 * Diritto di opposizione al trattamento (GDPR Art. 21)
 * Oppone al trattamento per motivi legittimi
 */
router.post('/object', validateInput(['reason', 'categories']), async (req, res) => {
  const userId = req.userId || req.user?.id;
  const {reason, categories} = req.body || {};
  const allowed = new Set([
    'personal_data', 'political_opinions', 'voting_data',
    'communication_data', 'technical_data'
  ]);
  if (!userId) {
    return res.status(401).json({success:false,error:'Autenticazione richiesta'});
  }
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000 ||
      !Array.isArray(categories) || categories.length < 1 ||
      categories.length > allowed.size ||
      categories.some(category => typeof category !== 'string' || !allowed.has(category)) ||
      new Set(categories).size !== categories.length) {
    return res.status(400).json({
      success:false,error:'Motivo o categorie della richiesta non validi'
    });
  }
  // The same browser retry key must correspond to exactly one objection.
  // Requests without this optional header keep the legacy behavior.
  const header = req.headers?.['idempotency-key'];
  if (header !== undefined && (
    typeof header !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(header)
  )) {
    return res.status(400).json({
      success:false,error:'Idempotency-Key non valida: serve un UUID v4'
    });
  }
  const requestId = header === undefined ? crypto.randomUUID() : header.toLowerCase();
  const payload = {reason:reason.trim(),categories};
  let stored;
  let replay = false;
  try {
    const saved = await pool.query(
      'INSERT INTO public.user_rights_requests ' +
      '(id, user_id, request_type, request_data, status) ' +
      "VALUES ($1::uuid, $2, 'object_processing', $3::jsonb, 'pending') " +
      'ON CONFLICT (id) DO NOTHING RETURNING id, user_id, request_type, status',
      [requestId, userId, JSON.stringify({
        ...payload,request_date:new Date().toISOString()
      })]
    );
    stored = saved.rows?.[0];
    replay = !stored;
    if (replay) {
      // A separate READ COMMITTED statement can see the unique-key winner
      // after PostgreSQL finishes waiting for its concurrent transaction.
      const previous = await pool.query(
        'SELECT id, status FROM public.user_rights_requests ' +
        "WHERE id=$1::uuid AND user_id=$2 AND request_type='object_processing' " +
        "AND request_data - 'request_date' = $3::jsonb LIMIT 1",
        [requestId,userId,JSON.stringify(payload)]
      );
      stored = previous.rows?.[0];
      if (!stored?.id) {
        return res.status(409).json({
          success:false,error:'Chiave già utilizzata o richiesta non verificabile'
        });
      }
    } else if (saved.rowCount !== 1 || !stored?.id ||
        String(stored.id).toLowerCase() !== requestId ||
        String(stored.user_id) !== String(userId) ||
        stored.request_type !== 'object_processing' ||
        stored.status !== 'pending') {
      throw Error('GDPR_OBJECTION_RECEIPT_NOT_CONFIRMED');
    }
  } catch (error) {
    console.error('GDPR_OBJECTION_PERSIST_FAILED', error?.code || 'QUERY_FAILED');
    return res.status(503).json({
      success:false,
      error:'Registrazione non confermata. Controlla lo storico prima di riprovare.'
    });
  }
  // The durable receipt is authoritative; audit delivery must not cause
  // duplicate objections or false HTTP failures. Never re-log a retry.
  if (!replay) {
    try {
      await AuditService.logAction({
        userId, action:'PROCESSING_OBJECTION', resource:'user_rights_requests',
        resourceId:stored.id, details:{categories},
        ipAddress:req.ip || req.connection?.remoteAddress,
        userAgent:req.get?.('User-Agent'), success:true
      });
    } catch (_) {
      console.error('GDPR_OBJECTION_SECONDARY_AUDIT_FAILED');
    }
  }
  return res.json({
    success:true,
    message:replay ? 'Opposizione già registrata. Controlla lo stato nello storico.' :
      'Opposizione al trattamento registrata. Verrà esaminata entro 30 giorni.',
    request_id:stored.id,
    ...(replay ? {replayed:true,request_status:stored.status} : {})
  });
});

/**
 * GET /api/user/rights-requests
 * Ottiene lo stato delle richieste diritti GDPR dell'utente
 */
// GET /api/user/rights-requests: same verified page contract as the
// /gdpr-requests alias. No DPO-only payload and no false total count.
router.get('/rights-requests', async (req, res) => {
  const userId = req.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({success:false,error:'Autenticazione richiesta'});
  }
  const options = parseRightsHistoryQuery(req.query || {});
  if (!options) {
    return res.status(400).json({
      success:false,error:'Parametri di paginazione non validi'
    });
  }
  try {
    const history = await readRightsHistory(pool, userId, options);
    return res.json({success:true, ...history});
  } catch(error) {
    // Database/visibility errors must not become a fabricated empty history.
    console.error('Errore recupero storico diritti GDPR:',error?.code||'QUERY_FAILED');
    return res.status(503).json({
      success:false,
      error:'Impossibile verificare lo storico delle richieste in questo momento'
    });
  }
});

module.exports = router;
