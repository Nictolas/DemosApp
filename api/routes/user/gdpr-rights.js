const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { validateInput } = require('../../middleware/validation');
const { pool } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');
// Usa crypto nativo invece di uuid
const crypto = require('crypto');

const router = express.Router();

// Middleware per tutti gli endpoint
router.use(verifyToken);

/**
 * GET /api/user/data-export
 * Diritto di accesso ai dati (GDPR Art. 15)
 * Esporta tutti i dati personali dell'utente in formato JSON
 */
router.get('/data-export', async (req, res) => {
  try {
    const userId = req.userId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    console.log(`📤 Richiesta esportazione dati per utente: ${userId}`);

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

    // 1. Recupera dati utente principali
    const userQuery = `
      SELECT id, email, nome, cognome, data_nascita, genere, cittadinanza, ruolo,
             paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
             paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
             grado_elezione, paese_candidatura, regione_candidatura, provincia_candidatura,
             comune_candidatura, grado_candidatura, status, premium, created_at, updated_at,
             privacy_policy_consent, terms_of_service_consent,
             consent_timestamp, consent_ip_address, consent_user_agent
      FROM users 
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    const userData = userResult.rows[0];

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

    // 7. Compila il report completo
    const dataExport = {
      export_info: {
        export_date: new Date().toISOString(),
        user_id: userId,
        format_version: '1.0',
        gdpr_article: 'Art. 15 - Diritto di accesso'
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
        }
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
      JSON.stringify({ export_date: dataExport.export_info.export_date })
    ]);

    res.json({
      success: true,
      data: dataExport,
      message: 'Esportazione dati completata con successo'
    });

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
  try {
    const userId = req.userId;
    const { confirmation } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (confirmation !== 'CONFERMO_CANCELLAZIONE_ACCOUNT') {
      return res.status(400).json({
        success: false,
        error: 'Conferma di cancellazione non valida'
      });
    }

    console.log(`🗑️ Richiesta cancellazione account per utente: ${userId}`);

    // Log dell'inizio cancellazione
    await AuditService.logAction({
      userId,
      action: 'DATA_DELETE_REQUEST',
      resource: 'user_account',
      details: { request_type: 'account_deletion' },
      ipAddress,
      userAgent,
      success: true
    });

    // 1. Registra la richiesta di cancellazione
    const requestQuery = `
      INSERT INTO user_rights_requests (user_id, request_type, request_data, status)
      VALUES ($1, $2, $3, 'processing')
      RETURNING id
    `;
    
    const requestResult = await pool.query(requestQuery, [
      userId,
      'data_erasure',
      JSON.stringify({ 
        deletion_date: new Date().toISOString(),
        confirmation: true 
      })
    ]);

    const requestId = requestResult.rows[0].id;

    // 2. Inizia transazione per cancellazione completa
    await pool.query('BEGIN');

    try {
      // 3. Anonimizza i voti (mantieni per statistiche)
      await pool.query(`
        UPDATE voti_capo_stato 
        SET userid = 'ANONYMIZED_' || userid 
        WHERE userid = $1
      `, [userId]);

      await pool.query(`
        UPDATE voti_referendum_abrogativi 
        SET userid = 'ANONYMIZED_' || userid 
        WHERE userid = $1
      `, [userId]);

      await pool.query(`
        UPDATE voti_iniziative_popolari 
        SET userid = 'ANONYMIZED_' || userid 
        WHERE userid = $1
      `, [userId]);

      await pool.query(`
        UPDATE voti_ice 
        SET userid = 'ANONYMIZED_' || userid 
        WHERE userid = $1
      `, [userId]);

      // 4. Cancella comunicazioni
      await pool.query('DELETE FROM comunicazioni WHERE id_utente = $1', [userId]);

      // 5. Cancella notifiche
      await pool.query('DELETE FROM user_notifications WHERE user_id = $1', [userId]);

      // 6. Cancella limitazioni trattamento
      await pool.query('DELETE FROM data_processing_limits WHERE user_id = $1', [userId]);

      // 7. Cancella richieste diritti
      await pool.query('DELETE FROM user_rights_requests WHERE user_id = $1', [userId]);

      // 8. Cancella log di audit
      await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);

      // 9. Cancella account utente
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      // 10. Conferma transazione
      await pool.query('COMMIT');

      // 11. Aggiorna stato richiesta
      await pool.query(`
        UPDATE user_rights_requests 
        SET status = 'completed', processed_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [requestId]);

      console.log(`✅ Account ${userId} cancellato con successo`);

      res.json({
        success: true,
        message: 'Account e tutti i dati associati sono stati cancellati con successo',
        deletion_date: new Date().toISOString()
      });

    } catch (error) {
      // Rollback in caso di errore
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Errore nella cancellazione account:', error);
    
    // Log dell'errore
    await AuditService.logAction({
      userId: req.userId,
      action: 'DATA_DELETE_REQUEST',
      resource: 'user_account',
      details: { request_type: 'account_deletion' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante la cancellazione dell\'account'
    });
  }
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
      'communication_data', 'technical_data', 'marketing_data'
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
