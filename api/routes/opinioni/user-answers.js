const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const { normalizeOpinionAnswer } = require('../../utils/politicalMatching');
const { createSupporterOpinionNotifications } = require('../../services/politicalOpinionNotificationService');
const { sendPushToCurrentSupporters } = require('../../services/currentSupporterPushService');

const router = express.Router();

// GET /api/opinioni/profile - Ottieni solo le domande delle opinioni (per EditOpinioniDialog)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/profile - Richiesta domande opinioni');
    
    // Query per ottenere le domande delle opinioni dalla tabella opinioni_domande
    // IMPORTANTE: usa l'ID reale dalla tabella, non generarlo dal testo
    // Escludi le opinioni con "da approvare" in gradi_opinione
    const opinionQuery = `
      SELECT id, text, gradi_opinione
      FROM opinioni_domande
      WHERE text IS NOT NULL 
        AND text != ''
        AND NOT ('da approvare' = ANY(gradi_opinione))
      ORDER BY text
    `;
    
    const opinionResult = await pool.query(opinionQuery);
    
    console.log(`🔍 DEBUG - Risultati query: ${opinionResult.rows.length} righe`);
    
    if (opinionResult.rows.length === 0) {
      console.log('⚠️ Nessuna opinione trovata nella tabella opinioni_domande');
      return res.json({
        success: true,
        data: {
          questions: []
        },
        message: 'Nessuna opinione disponibile'
      });
    }
    
    // Formatta le domande per il frontend - USA L'ID REALE dalla tabella
    const questions = opinionResult.rows.map(row => ({
      id: row.id, // Usa l'ID reale dalla tabella opinioni_domande
      text: row.text
    }));
    
    console.log(`✅ Trovate ${questions.length} domande opinioni`);
    console.log(`🔍 DEBUG - Prime 3 domande:`, questions.slice(0, 3));

    res.json({
      success: true,
      data: {
        questions: questions
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare domande opinioni:', error);
    
    // Se la tabella non esiste, restituisci un array vuoto invece di un errore
    if (error.code === '42P01') { // Tabella non esiste
      console.log('⚠️ Tabella opinioni_domande non esiste, restituisco array vuoto');
      return res.json({
        success: true,
        data: {
          questions: []
        },
        message: 'Tabella opinioni_domande non disponibile'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare domande opinioni'
    });
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
    const getOpinioneIdByText = async (opinionText) => {
      const result = await pool.query(`
        SELECT id FROM opinioni_domande 
        WHERE text ILIKE $1
      `, [`%${opinionText.replace(/_/g, ' ')}%`]);
      return result.rows[0]?.id;
    };
    
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

      // Coordinate opinion writes with consent revocation by locking the SAME
      // users row that PUT /political-opinions-consent/revoke updates first.
      // A pre-transaction consent check is insufficient: revocation could
      // commit after that check and before the answer INSERT/UPDATE.
      // In READ COMMITTED, FOR UPDATE waits for an in-flight revocation,
      // then reads its new committed consent value. Hold this row lock
      // through the opinion write and COMMIT.
      // Lock first; read the consent override in a SEPARATE statement.
      // This matters in READ COMMITTED: a subquery in the locking
      // statement could otherwise observe an older user_consents snapshot
      // while waiting for the revoked users row to become available.
      const lockedUser = await client.query(
        'SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]
      );
      if (lockedUser.rows.length === 0) {
        throw Object.assign(new Error('User absent at opinion save'), {
          code: 'OPINION_USER_NOT_FOUND'
        });
      }
      const consentState = await client.query(`
        SELECT COALESCE(
          uc.political_opinions_consent,
          u.political_opinions_consent,
          false
        ) AS granted
        FROM users u
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE u.id = $1
      `, [userId]);
      if (consentState.rows[0]?.granted !== true) {
        throw Object.assign(new Error('Political consent revoked at opinion save'), {
          code: 'OPINION_CONSENT_REQUIRED'
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
        // Evita UPDATE inutili delle risposte già identiche: con 94 opinioni
        // inviate in blocco, una sola risposta modificata deve scrivere
        // soltanto quella colonna. Il conteggio delle risposte accettate rimane invariato.
        const actualChanges = insertFields
          .map((field, index) => ({
            opinionId: field,
            previousValue: previous[field],
            newValue: insertValues[index]
          }))
          .filter((change) => change.previousValue !== change.newValue);

        // NULL/non risposta → prima risposta a quella singola Opinione: niente notifica.
        const changes = actualChanges.filter((change) =>
          ['f', 'c', 'i'].includes(change.previousValue) &&
          change.previousValue !== change.newValue
        );

        if (actualChanges.length > 0) {
          const changedAssignments = actualChanges.map((change, index) =>
            `"${String(change.opinionId).replace(/"/g, '""')}" = $${index + 1}`
          );
          const changedValues = actualChanges.map((change) => change.newValue);
          const updateQuery = `
            UPDATE opinioni_risposte
            SET ${changedAssignments.join(', ')}
            WHERE user_id = $${actualChanges.length + 1}
          `;
          const result = await client.query(updateQuery, [...changedValues, userId]);
          if (result.rowCount === 0) {
            throw new Error('Nessuna riga Opinioni aggiornata');
          }
        }
        savedCount = insertFields.length;

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
    if (error?.code === 'OPINION_USER_NOT_FOUND') {
      return res.status(404).json({success:false,error:'Utente non trovato'});
    }
    if (error?.code === 'OPINION_CONSENT_REQUIRED') {
      return res.status(403).json({
        success: false,
        error: 'Consenso richiesto',
        message: 'Per salvare opinioni politiche è necessario un consenso esplicito attivo.',
        consent_required: true
      });
    }
    console.error('❌ Errore nel salvare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile salvare le opinioni'
    });
  }
});

// GET /api/opinioni/:id/approfondimento - Ottieni approfondimento di un'opinione
router.get('/:id/approfondimento', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 GET /api/opinioni/:id/approfondimento - Richiesta approfondimento per opinione:', id);

    // Determina dinamicamente i nomi delle colonne (per gestire varianti approfondimento/approfondimenti, gradi_opinione/gradi_opinioni)
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_domande'
    `);
    const columnNames = new Set(columnsResult.rows.map(r => r.column_name));

    const approfondimentoColumn = columnNames.has('approfondimento')
      ? 'approfondimento'
      : (columnNames.has('approfondimenti') ? 'approfondimenti' : null);

    const gradiColumn = columnNames.has('gradi_opinione')
      ? 'gradi_opinione'
      : (columnNames.has('gradi_opinioni') ? 'gradi_opinioni' : null);

    if (!approfondimentoColumn) {
      console.warn('⚠️ Tabella opinioni_domande non ha nessuna colonna approfondimento/approfondimenti');
    }

    // Costruisci SELECT con alias standardizzati: approfondimento, gradi_opinione
    const buildSelectQuery = (whereClause) => `
      SELECT 
        id, 
        text, 
        ${approfondimentoColumn ? `${approfondimentoColumn} AS approfondimento` : `NULL::text AS approfondimento`},
        ${gradiColumn ? `${gradiColumn} AS gradi_opinione` : `ARRAY[]::text[] AS gradi_opinione`}
      FROM opinioni_domande
      ${whereClause}
    `;

    // Cerca prima per ID diretto (funziona per UUID, ID numerici e ID testuali)
    // Poi fallback per testo se non trovato
    let result = await pool.query(buildSelectQuery('WHERE id = $1'), [id]);

    if (result.rows.length === 0) {
      console.log('⚠️ Opinione non trovata per ID, provo con testo:', id);
      // Fallback: prova a cercare per testo (es. energia_nucleare -> "energia nucleare")
      const textToSearch = id.replace(/_/g, ' ');
      result = await pool.query(
        buildSelectQuery('WHERE LOWER(TRIM(text)) = LOWER(TRIM($1))'),
        [textToSearch]
      );
      
      if (result.rows.length === 0) {
        console.log('⚠️ Opinione non trovata nemmeno per testo:', textToSearch);
        return res.status(404).json({
          success: false,
          error: 'Opinione non trovata'
        });
      }
    }
    
    const opinione = result.rows[0];

    // Usa esattamente il testo salvato nel DB (colonna approfondimento)
    const approfondimento = opinione.approfondimento || '';
    
    console.log('✅ Opinione trovata:', {
      id: opinione.id,
      text: opinione.text,
      hasApprofondimento: !!approfondimento,
      gradi_opinione: opinione.gradi_opinione
    });
    
    res.json({
      success: true,
      data: {
        id: opinione.id,
        text: opinione.text,
        approfondimento,
        gradi_opinione: opinione.gradi_opinione || []
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare approfondimento:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Se la tabella non esiste, restituisci dati di default
    if (error.code === '42P01') { // Tabella non esiste
      console.log('⚠️ Tabella opinioni_domande non esiste, restituisco dati di default');
      return res.json({
        success: true,
        data: {
          id: req.params.id,
          text: 'Opinione non trovata',
          approfondimento: '',
          gradi_opinione: []
        }
      });
    }
    
    // Se la colonna non esiste, restituisci dati di default
    if (error.code === '42703') { // Colonna non esiste
      console.log('⚠️ Colonna non esiste nella tabella opinioni_domande, restituisco dati di default');
      return res.json({
        success: true,
        data: {
          id: req.params.id,
          text: 'Opinione non trovata',
          approfondimento: '',
          gradi_opinione: []
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare approfondimento',
      details: error.message
    });
  }
});

// PUT /api/opinioni/:id/approfondimento - Aggiorna approfondimento di un'opinione (solo admin)
router.put('/:id/approfondimento', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; // ID vecchio (UUID temporaneo)
    const { approfondimento, gradi_opinione, customId } = req.body; // customId = nuovo ID scelto dall'admin
    
    console.log('💾 PUT /api/opinioni/:id/approfondimento - Salvataggio approfondimento per opinione:', id);
    console.log('📋 Dati ricevuti:', { approfondimento, gradi_opinione, customId });
    
    // Determina se è un cambio ID (da UUID a ID personalizzato)
    let actualId = id;
    const isChangingId = customId && customId.trim() && customId.trim() !== id;
    
    if (isChangingId) {
      console.log('📝 L\'admin vuole cambiare l\'ID da', id, 'a', customId);
      
      // Verifica se il nuovo ID esiste già
      const checkNewIdQuery = `SELECT id FROM opinioni_domande WHERE id = $1`;
      const checkNewId = await pool.query(checkNewIdQuery, [customId]);
      
      if (checkNewId.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'ID già esistente',
          message: `L'ID "${customId}" è già utilizzato da un'altra opinione.`
        });
      }
      
      // Recupera l'opinione originale (UUID)
      const getOriginalQuery = `SELECT id, text, gradi_opinione, approfondimento FROM opinioni_domande WHERE id = $1`;
      const originalResult = await pool.query(getOriginalQuery, [id]);
      
      if (originalResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Opinione originale non trovata',
          message: `Nessuna opinione trovata con ID: ${id}`
        });
      }
      
      const originalOpinion = originalResult.rows[0];
      
      // Crea la nuova opinione con il nuovo ID
      const insertNewQuery = `
        INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
        VALUES ($1, $2, $3, $4)
      `;
      await pool.query(insertNewQuery, [
        customId.trim(),
        originalOpinion.text, // Mantieni il testo originale
        gradi_opinione, // Nuovi gradi selezionati
        approfondimento // Nuovo approfondimento
      ]);
      
      console.log('✅ Nuova opinione creata con ID:', customId);
      
      // Cancella tutti i voti nella tabella voti_opinioni_proposte (non servono più)
      const deleteVotesQuery = `DELETE FROM voti_opinioni_proposte WHERE opinione_id = $1`;
      const deleteVotesResult = await pool.query(deleteVotesQuery, [id]);
      console.log(`📊 Cancellati ${deleteVotesResult.rowCount} voti temporanei per l'opinione ${id}`);
      
      // Elimina l'opinione originale
      const deleteOldQuery = `DELETE FROM opinioni_domande WHERE id = $1`;
      await pool.query(deleteOldQuery, [id]);
      
      console.log('✅ Vecchia opinione eliminata con ID:', id);
      
      // Usa il nuovo ID per il resto
      actualId = customId.trim();
    }
    
    // Se abbiamo cambiato ID, non serve fare UPDATE (già fatto con INSERT)
    let result;
    if (isChangingId) {
      // L'opinione è già stata creata con il nuovo ID, basta recuperarla
      const getNewOpinionQuery = `SELECT id, text, approfondimento, gradi_opinione FROM opinioni_domande WHERE id = $1`;
      result = await pool.query(getNewOpinionQuery, [actualId]);
      
      console.log('✅ Approfondimento salvato con successo per opinione (nuovo ID):', actualId);
    } else {
      // Cerca per ID se è numerico, altrimenti cerca per text o id diretto
      let updateQuery, params;
      if (/^\d+$/.test(actualId)) {
        // ID numerico
        updateQuery = `
          UPDATE opinioni_domande 
          SET approfondimento = $1, gradi_opinione = $2
          WHERE id::text = $3
          RETURNING id, text, approfondimento, gradi_opinione
        `;
        params = [approfondimento || '', gradi_opinione || [], actualId];
      } else {
        // ID testuale
        updateQuery = `
          UPDATE opinioni_domande 
          SET approfondimento = $1, gradi_opinione = $2
          WHERE id = $3
          RETURNING id, text, approfondimento, gradi_opinione
        `;
        params = [approfondimento || '', gradi_opinione || [], actualId];
      }
      
      console.log('🔍 DEBUG - Query:', updateQuery);
      console.log('🔍 DEBUG - Params:', params);
      result = await pool.query(updateQuery, params);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Opinione non trovata'
        });
      }
      
      console.log('✅ Approfondimento salvato con successo per opinione:', actualId);
    }
    
    // Aggiungi la colonna corrispondente in opinioni_risposte se non esiste
    try {
      const checkColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'opinioni_risposte' 
        AND column_name = $1
      `;
      const columnCheck = await pool.query(checkColumnQuery, [actualId]);
      
      if (columnCheck.rows.length === 0) {
        console.log(`📊 Aggiungo colonna ${actualId} a opinioni_risposte...`);
        // Usa un identificatore quotato per il nome della colonna
        const addColumnQuery = `ALTER TABLE opinioni_risposte ADD COLUMN "${actualId}" TEXT`;
        await pool.query(addColumnQuery);
        console.log(`✅ Colonna ${actualId} aggiunta a opinioni_risposte`);
      }
    } catch (error) {
      console.error('❌ Errore nell\'aggiungere colonna opinioni_risposte:', error);
      // Non bloccare l'operazione se fallisce
    }
    
    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        text: result.rows[0].text,
        approfondimento: result.rows[0].approfondimento,
        gradi_opinione: result.rows[0].gradi_opinione
      },
      message: 'Approfondimento salvato con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvare approfondimento:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Se la colonna non esiste, restituisci un errore specifico
    if (error.code === '42703') { // Colonna non esiste
      console.log('⚠️ Colonna non esiste nella tabella opinioni_domande');
      return res.status(500).json({
        success: false,
        error: 'Colonna mancante',
        message: 'Le colonne approfondimento e gradi_opinione devono essere aggiunte alla tabella opinioni_domande'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare approfondimento',
      details: error.message
    });
  }
});

module.exports = router;
