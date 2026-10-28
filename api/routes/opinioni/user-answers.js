const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const { normalizeOpinionAnswer } = require('../../utils/politicalMatching');
const { createSupporterOpinionNotifications } = require('../../services/politicalOpinionNotificationService');
const { sendPushToCurrentSupporters } = require('../../services/currentSupporterPushService');

const { getAllOpinions, getOpinionById, findOpinionIdByText, sortOpinionsByText } = require('../../services/opinionCatalog');

const router = express.Router();

// Read-only official questions from the versioned code catalog. No DB hit.
router.get('/profile', verifyToken, (_req, res) => {
  const questions = sortOpinionsByText(getAllOpinions()).map(({id,text})=>({id,text}));
  res.json({success:true,data:{questions}});
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
    
    console.log('💾 POST /api/opinioni/salva - Salvataggio opinioni utente');
    console.log('👤 User ID:', userId);
    
    if (!opinioni || typeof opinioni !== 'object' || Object.keys(opinioni).length === 0) {
      console.error('❌ ERRORE: Dati mancanti o non validi');
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
    
    // Mappa delle opinioni ai campi del database
    const opinionMapping = {
      'energia_nucleare': 'energia_nucleare',
      'sperimentazione_animale': 'sperimentazione_animale',
      'legalizzazione_canapa': 'legalizzazione_canapa',
      'caccia': 'caccia',
      'eutanasia': 'eutanasia',
      'carne_coltivata': 'carne_coltivata',
      'nato': 'nato',
      'matrimonio_gay': 'matrimonio_gay',
      'salario_minimo': 'salario_minimo',
      'case_chiuse': 'case_chiuse',
      'omobitransfobia': 'omobitransfobia',
      'nuovi_inceneritori': 'nuovi_inceneritori',
      'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
      'cassonetti_intelligenti_con_tessera': 'cassonetti_intelligenti_con_tessera',
      'concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
      'divieto_di_nuovi_fast_food_nel_centro_storico': 'divieto_di_nuovi_fast_food_nel_centro_storico',
      'estensione_delle_zone_a_traffico_limitato': 'estensione_delle_zone_a_traffico_limitato',
      'finanziamento_eventi_culturali_gratuiti': 'finanziamento_eventi_culturali_gratuiti',
      'nuova_biblioteca_comunale': 'nuova_biblioteca_comunale',
      'nuove_case_popolari': 'nuove_case_popolari',
      'nuove_piste_ciclabili': 'nuove_piste_ciclabili',
      'nuovi_asili_nido_comunali': 'nuovi_asili_nido_comunali',
      'nuovo_stadio_comunale': 'nuovo_stadio_comunale',
      'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
      'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
      'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
      'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
      'sostegno_commercio_locale': 'sostegno_commercio_locale',
      'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini',
      'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
      'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
      'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
      'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
      'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento'
    };
    
    // Prepara i campi da aggiornare
    const updateFields = [];
    const insertFields = [];
    const insertValues = [];
    let paramIndex = 1;
    
    const unmappedOpinions = [];
    
    // Verifica quali colonne esistono in opinioni_risposte
    // Usa direttamente gli ID inviati dal frontend (che provengono da opinioni_domande)
    const opinionIdsToCheck = Object.keys(opinioni);
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' 
      AND column_name != 'user_id'
      AND column_name != 'fonti_opinioni'
      AND column_name = ANY($1::text[])
    `;
    const checkColumnsResult = await pool.query(checkColumnsQuery, [opinionIdsToCheck]);
    const existingColumns = new Set(checkColumnsResult.rows.map(row => row.column_name));
    
    console.log(`🔍 DEBUG - Opinion da verificare: ${opinionIdsToCheck.length}`);
    
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      
      // Usa direttamente l'ID inviato dal frontend (che proviene da opinioni_domande)
      // Verifica solo che la colonna esista in opinioni_risposte
      let dbField = opinionId;
      
      if (!existingColumns.has(opinionId)) {
        // Se la colonna non esiste, prova il mapping (per compatibilità con vecchie opinioni)
        dbField = opinionMapping[opinionId];
        if (!dbField) {
          console.warn('⚠️ Campo opinione non riconosciuto');
          unmappedOpinions.push(opinionId);
          errorCount++;
          continue;
        } else {
        }
      } else {
      }
      
      // Una volta espressa, un'Opinione può soltanto cambiare tra f/c/i: NULL non è una risposta.
      const dbValue = normalizeOpinionAnswer(risposta);
      if (!dbValue) {
        console.warn('⚠️ Valore opinione non valido: sono ammesse solo Favorevole, Contrario o Non lo so');
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
      console.error(`❌ ${unmappedOpinions.length} opinioni non mappate`);
    }
    
    if (updateFields.length === 0) {
      console.error('❌ Nessun campo valido da aggiornare');
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

      // Serialize saving with consent revocation, which UPDATE-locks users.
      // The earlier read is only a fast precheck: it is NOT authoritative
      // when revocation can run concurrently on another connection.
      const lockedConsent = await client.query(`
        SELECT COALESCE(
          uc.political_opinions_consent,
          u.political_opinions_consent,
          false
        ) AS granted
        FROM users u
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE u.id = $1
        FOR UPDATE OF u
      `, [userId]);
      if (lockedConsent.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Utente non trovato' });
      }
      if (lockedConsent.rows[0].granted !== true) {
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
        console.log(`✅ Prima risposta salvata. Righe inserite: ${result.rowCount}`);
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
      console.log(`✅ Salvate ${savedCount} opinioni per utente ${userId}`);
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
        console.warn('Push cambio Opinione non disponibile:', pushError?.message || pushError);
      }
    }

    console.log(`📊 Risultato salvataggio: ${savedCount} salvate, ${errorCount} errori`);
    
    if (savedCount === 0) {
      console.error('❌ ERRORE: Nessuna opinione salvata');
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    console.log('✅ Opinion salvate con successo per utente:', userId);
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      savedCount: savedCount,
      errorCount: errorCount,
      notificationsCreated,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvare opinioni:', error);
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
