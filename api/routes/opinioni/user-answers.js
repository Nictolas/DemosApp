const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const { normalizeOpinionAnswer } = require('../../utils/politicalMatching');
const { createSupporterOpinionNotifications } = require('../../services/politicalOpinionNotificationService');
const { sendPushToCurrentSupporters } = require('../../services/currentSupporterPushService');

const { getAllOpinions, getOpinionById, findOpinionIdByText, sortOpinionsByText } = require('../../services/opinionCatalog');

const router = express.Router();

// Legacy /profile returns only public question metadata (zero SQL reads).
// The owner profile can explicitly opt into one consent-guarded personal read.
// Do not change the lightweight, catalog-only Android/client contract.
router.get('/profile', verifyToken, async (req, res) => {
  const catalog = sortOpinionsByText(getAllOpinions());
  const questions = catalog.map(({id,text})=>({id,text}));
  if (req.query.includeAnswers !== '1') {
    return res.json({success:true,data:{questions}});
  }

  // This is a sensitive political-answer response. Never let intermediaries
  // cache it, including errors, and never read another user's opinions.
  res.set('Cache-Control', 'private, no-store, max-age=0');
  if (!req.userId) {
    return res.status(401).json({success:false,error:'Autenticazione richiesta'});
  }

  try {
    // IDs are published, lowercase catalog IDs, verified at startup; they
    // cannot originate from request parameters. Only answer columns are read,
    // excluding fonti_opinioni and other private account attributes.
    const projection = catalog.map(({id}) => `a."${id}"`).join(', ');
    const sql = `
      SELECT COALESCE(uc.political_opinions_consent,
                      u.political_opinions_consent, false) AS granted,
             row_to_json(answers) AS selected_answers
      FROM users u
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT ${projection}
        FROM opinioni_risposte a
        WHERE a.user_id = u.id
          AND COALESCE(uc.political_opinions_consent,
                       u.political_opinions_consent, false) = true
      ) answers ON true
      WHERE u.id = $1
    `;
    const result = await pool.query(sql, [req.userId]);
    if (!result.rows.length) {
      return res.status(404).json({success:false,error:'Utente non trovato'});
    }
    if (result.rows[0].granted !== true) {
      return res.status(403).json({success:false,error:'Consenso richiesto',consent_required:true});
    }
    const raw = result.rows[0].selected_answers || {};
    const userAnswers = {};
    for (const {id} of catalog) {
      // Preserve only definite/indecisive answer codes; nulls remain absent.
      const answer = raw[id];
      if (answer === 'f' || answer === 'c' || answer === 'i') userAnswers[id] = answer;
    }
    return res.json({success:true,data:{questions,userAnswers}});
  } catch (_error) {
    // No SQL details, user IDs or political values in HTTP responses or logs.
    return res.status(500).json({success:false,error:'Errore nel caricamento delle Opinioni'});
  }
});

// POST /api/opinioni/salva - Salva le opinioni dell'utente  
// Expressing a personal opinion is not an institutional ballot: require account authentication
// and explicit Art. 9 consent (checked below), but do not require CIE.
router.post('/salva', verifyToken, async (req, res) => {
  // Le opinioni sono categorie di dati particolarmente sensibili: non loggare body o valori.
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_error) {
      return res.status(400).json({
        success: false,
        error: 'JSON non valido'
      });
    }
  }

  try {
    const userId = req.userId;

    // Le opinioni politiche possono essere salvate solo con consenso esplicito attivo.
    const consentResult = await pool.query(`
      SELECT COALESCE(
        uc.political_opinions_consent,
        u.political_opinions_consent,
        false
      ) AS granted
      FROM users u
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE u.id = $1
    `, [userId]);

    if (consentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    if (consentResult.rows[0].granted !== true) {
      return res.status(403).json({
        success: false,
        error: 'Consenso richiesto',
        message: 'Per salvare opinioni politiche è necessario un consenso esplicito attivo.',
        consent_required: true
      });
    }

    // Il frontend invia le opinioni direttamente nel body
    const opinioni = req.body.opinioni || req.body; // Accetta sia req.body.opinioni che req.body
    
    
    if (!opinioni || typeof opinioni !== 'object' || Object.keys(opinioni).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti',
        message: 'Il campo opinioni è obbligatorio'
      });
    }
    
    // Funzione per ottenere l'ID dell'opinione dal testo
    const getOpinioneIdByText = async (opinionText) => findOpinionIdByText(opinionText);

    // Salva le opinioni nella struttura con colonne separate
    let savedCount = 0;
    let errorCount = 0;
    let notificationsCreated = 0;
    let changedOpinionsForPush = [];
    
    
    // Prepara i campi da aggiornare
    const updateFields = [];
    const insertFields = [];
    const insertValues = [];
    let paramIndex = 1;
    
    const unmappedOpinions = [];
    
    // Published IDs are the canonical SQL column allowlist; no metadata SELECT.
    
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      
      // Accept only opinion IDs published in this release. The 94/94
      // catalog-to-answer-column parity is a mandatory pre-release check.
      const dbField = getOpinionById(opinionId)?.id;
      if (!dbField) {
        unmappedOpinions.push(opinionId);
        errorCount++;
        continue;
      }

      // Una volta espressa, un'Opinione può soltanto cambiare tra f/c/i: NULL non è una risposta.
      const dbValue = normalizeOpinionAnswer(risposta);
      if (!dbValue) {
        unmappedOpinions.push(opinionId);
        errorCount++;
        continue;
      }
      
      updateFields.push(`${dbField} = $${paramIndex}`);
      insertFields.push(dbField);
      insertValues.push(dbValue);
      paramIndex++; // Questo viene usato solo per UPDATE, per INSERT usiamo i + 2
      
    }
    
    if (unmappedOpinions.length > 0) {
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    // Salva la posizione e l'eventuale evento di cambio nello stesso commit DB.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the exact users row shared with consent revocation/deletion.
      // IMPORTANT: In READ COMMITTED the consent must be read in a SECOND
      // statement after FOR UPDATE has acquired the lock. Reading consent
      // in the locking SELECT can use a stale statement snapshot when a
      // concurrent revocation commits while waiting for that lock.
      const lockedUser = await client.query(
        'SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]
      );
      if (lockedUser.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Utente non trovato' });
      }
      const lockedConsent = await client.query(`
        SELECT COALESCE(
          uc.political_opinions_consent,
          u.political_opinions_consent,
          false
        ) AS granted
        FROM users u
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE u.id = $1
      `, [userId]);
      if (lockedConsent.rows.length === 0 || lockedConsent.rows[0].granted !== true) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'Consenso richiesto',
          message: 'Per salvare opinioni politiche è necessario un consenso esplicito attivo.',
          consent_required: true
        });
      }

      const quotedFields = insertFields.map((field) => `"${String(field).replace(/"/g, '""')}"`);
      const checkQuery = `
        SELECT user_id${quotedFields.length ? `, ${quotedFields.join(', ')}` : ''}
        FROM opinioni_risposte
        WHERE user_id = $1
        FOR UPDATE
      `;
      const checkResult = await client.query(checkQuery, [userId]);

      if (checkResult.rows.length === 0) {
        // Prima risposta: salva, ma non notificare i sostenitori.
        const insertQuery = `
          INSERT INTO opinioni_risposte (user_id, ${insertFields.join(', ')})
          VALUES ($1, ${insertFields.map((_, i) => `$${i + 2}`).join(', ')})
        `;
        const allValues = [userId, ...insertValues];
        const result = await client.query(insertQuery, allValues);
        savedCount = insertFields.length;
      } else {
        const previous = checkResult.rows[0];
        const changes = insertFields
          .map((field, index) => ({
            opinionId: field,
            previousValue: previous[field],
            newValue: insertValues[index]
          }))
          // NULL/non risposta → prima risposta a quella singola Opinione: niente notifica.
          .filter((change) =>
            ['f', 'c', 'i'].includes(change.previousValue) &&
            change.previousValue !== change.newValue
          );

        const updateQuery = `
          UPDATE opinioni_risposte
          SET ${updateFields.join(', ')}
          WHERE user_id = $${updateFields.length + 1}
        `;
        const allValues = [...insertValues, userId];
        const result = await client.query(updateQuery, allValues);
        savedCount = updateFields.length;
        if (result.rowCount === 0) {
          throw new Error('Nessuna riga Opinioni aggiornata');
        }

        if ((req.user?.isPolitician || req.user?.isCandidate) && changes.length > 0) {
          const notificationResult = await createSupporterOpinionNotifications(client, {
            subjectUserId: userId,
            changes
          });
          notificationsCreated = notificationResult.created;
          changedOpinionsForPush = changes;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (notificationsCreated > 0 && changedOpinionsForPush.length > 0) {
      try {
        const kind = req.user?.isPolitician && req.user?.isCandidate
          ? 'both'
          : (req.user?.isCandidate ? 'candidate' : 'representative');
        await sendPushToCurrentSupporters(pool, {
          subjectUserId: userId,
          kind,
          title: 'Cambio di posizione',
          body: changedOpinionsForPush.length === 1
            ? 'Un profilo che sostieni ha cambiato una posizione politica.'
            : `Un profilo che sostieni ha cambiato ${changedOpinionsForPush.length} posizioni politiche.`,
          data: {
            type: 'political_opinion_change',
            subjectUserId: userId,
            link: 'https://www.demos.community/notifiche'
          }
        });
      } catch (pushError) {
      }
    }

    
    if (savedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      savedCount: savedCount,
      errorCount: errorCount,
      notificationsCreated,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // Keep an actionable error class without logging user IDs, answers or SQL values.
    console.error('Opinion save failed', error?.code || error?.name || 'UNKNOWN');
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile salvare le opinioni'
    });
  }
});

// GET details for a published question, without a database lookup.
router.get('/:id/approfondimento', verifyToken, (req, res) => {
  const opinion = getOpinionById(req.params.id)
    || getOpinionById(findOpinionIdByText(req.params.id));
  if(!opinion) return res.status(404).json({success:false,error:'Opinione non trovata'});
  return res.json({success:true,data:{
    id:opinion.id,text:opinion.text,
    approfondimento:opinion.approfondimento,
    gradi_opinione:opinion.gradi_opinione
  }});
});

// Old Admin clients cannot change catalog content without a backend release.
router.put('/:id/approfondimento', verifyToken, requireAdmin, (_req, res) => {
  res.status(409).json({success:false,error:'CATALOG_RELEASE_REQUIRED',
    message:'Approfondimenti e gradi delle Opinioni si modificano solo tramite release.'});
});

module.exports = router;
