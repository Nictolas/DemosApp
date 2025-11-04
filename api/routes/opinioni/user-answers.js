const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni/profile - Ottieni solo le domande delle opinioni (per EditOpinioniDialog)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/profile - Richiesta domande opinioni');
    
    // Query per ottenere le domande delle opinioni dalla tabella opinioni_domande
    const opinionQuery = `
      SELECT DISTINCT 
        CASE 
          WHEN o.gradi_opinione IS NOT NULL AND array_length(o.gradi_opinione, 1) > 0 
          THEN o.gradi_opinione[1] 
          ELSE 'Nazionale' 
        END as grado_primario, 
        o.text
      FROM opinioni_domande o
      WHERE o.text IS NOT NULL AND o.text != ''
      ORDER BY grado_primario, o.text
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
    
    // Formatta le domande per il frontend - SENZA prefisso del grado
    const questions = opinionResult.rows.map(row => ({
      id: row.text.replace(/\s+/g, '_'),
      text: row.text
    }));
    
    console.log(`✅ Trovate ${questions.length} domande opinioni`);

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
router.post('/salva', async (req, res) => {
  console.log('🚨🚨🚨🚨🚨 SECONDA VERSIONE - POST /api/opinioni/salva CHIAMATO! 🚨🚨🚨🚨🚨');
  console.log('🚨 DEBUG: req.body RAW:', req.body);
  console.log('🚨 DEBUG: req.body tipo:', typeof req.body);
  console.log('🚨 DEBUG: req.body keys:', Object.keys(req.body || {}));
  console.log('🚨 DEBUG: req.headers:', req.headers);
  
  // Se req.body è una stringa, prova a parsearla
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
      console.log('🚨 DEBUG: Parsed JSON body:', req.body);
    } catch (e) {
      console.error('🚨 DEBUG: Errore parsing JSON:', e);
    }
  }
  
  console.log('🚨 DEBUG: req.body:', JSON.stringify(req.body, null, 2));
  
  // Controllo token manuale
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token mancante' });
  }
  
  const token = authHeader.substring(7);
  const { verifyAccessToken } = require('../../utils/jwt');
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Token non valido' });
  }
  
  req.userId = decoded.userId || decoded.email;
  console.log('🚨 DEBUG: req.userId:', req.userId);
  console.log('🚨 DEBUG: Chiavi disponibili in opinionMapping:', Object.keys({
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
    }));
  
  try {
    const userId = req.userId;
    // Il frontend invia le opinioni direttamente nel body
    const opinioni = req.body.opinioni || req.body; // Accetta sia req.body.opinioni che req.body
    
    console.log('💾 POST /api/opinioni/salva - Salvataggio opinioni utente');
    console.log('👤 User ID:', userId);
    console.log('📋 Opinion ricevute:', opinioni);
    console.log('🔍 Tipo opinioni:', typeof opinioni);
    console.log('🔍 Chiavi opinioni:', Object.keys(opinioni || {}));
    console.log('🔍 DETTAGLIO opinioni ricevute:');
    if (opinioni && typeof opinioni === 'object') {
      Object.entries(opinioni).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    if (!opinioni || typeof opinioni !== 'object' || Object.keys(opinioni).length === 0) {
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
    
    // Prima verifica quali opinioni esistono nel database
    const opinionIdsToCheck = Object.keys(opinioni);
    const checkOpinionsQuery = `
      SELECT id FROM opinioni_domande 
      WHERE id = ANY($1::text[])
    `;
    const checkOpinionsResult = await pool.query(checkOpinionsQuery, [opinionIdsToCheck]);
    const existingOpinionIds = new Set(checkOpinionsResult.rows.map(row => row.id));
    
    console.log(`🔍 DEBUG - Opinion da verificare: ${opinionIdsToCheck.length}`);
    console.log(`🔍 DEBUG - Opinion esistenti nel DB: ${existingOpinionIds.size}`);
    console.log(`🔍 DEBUG - Opinion esistenti:`, Array.from(existingOpinionIds));
    
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      console.log(`🔍 DEBUG - Processando opinione: ${opinionId} = ${risposta}`);
      
      // Prima verifica se l'ID esiste nel database (per nuove opinioni)
      let dbField = opinionId;
      
      if (!existingOpinionIds.has(opinionId)) {
        // Se non esiste nel database, prova il mapping (per compatibilità con vecchie opinioni)
        dbField = opinionMapping[opinionId];
        if (!dbField) {
          console.warn(`⚠️ Campo non mappato e non trovato nel DB: ${opinionId}`);
          unmappedOpinions.push(opinionId);
          errorCount++;
          continue;
        }
        console.log(`ℹ️ Usato mapping per opinione: ${opinionId} -> ${dbField}`);
      } else {
        console.log(`✅ Opinione trovata nel DB: ${opinionId}`);
      }
      
      // Converti i valori al formato corretto
      let dbValue = null;
      if (risposta === 'f') dbValue = 'f';
      else if (risposta === 'c') dbValue = 'c';
      else if (risposta === 'i') dbValue = 'i';
      else if (risposta === 'Favorevole') dbValue = 'f';
      else if (risposta === 'Contrario') dbValue = 'c';
      else if (risposta === 'Indeciso') dbValue = 'i';
      else if (risposta === 'Astenuto') dbValue = null;
      else {
        console.warn(`⚠️ Valore non riconosciuto: ${risposta} per opinione ${opinionId}`);
        unmappedOpinions.push(opinionId);
        errorCount++;
        continue;
      }
      
      updateFields.push(`${dbField} = $${paramIndex}`);
      insertFields.push(dbField);
      insertValues.push(dbValue);
      paramIndex++; // Questo viene usato solo per UPDATE, per INSERT usiamo i + 2
      
      console.log(`✅ Preparato campo: ${dbField} = ${dbValue}`);
    }
    
    if (unmappedOpinions.length > 0) {
      console.error(`❌ Opinion non mappate: ${unmappedOpinions.join(', ')}`);
    }
    
    if (updateFields.length === 0) {
      console.error('❌ Nessun campo valido da aggiornare');
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    // Esegui l'aggiornamento
    try {
      // Prima controlla se l'utente ha già delle risposte
      const checkQuery = `SELECT user_id FROM opinioni_risposte WHERE user_id = $1`;
      const checkResult = await pool.query(checkQuery, [userId]);
      
      if (checkResult.rows.length === 0) {
        // Prima volta: inserisci tutte le opinioni
        const insertQuery = `
          INSERT INTO opinioni_risposte (user_id, ${insertFields.join(', ')})
          VALUES ($1, ${insertFields.map((_, i) => `$${i + 2}`).join(', ')})
        `;
        
        const allValues = [userId, ...insertValues];
        console.log('🔍 DEBUG - Prima volta, inserisco tutte le opinioni');
        console.log('🔍 DEBUG - Query SQL:', insertQuery);
        console.log('🔍 DEBUG - Valori query:', allValues);
        console.log('🔍 DEBUG - Campi:', insertFields);
        console.log('🔍 DEBUG - Indice parametri:', paramIndex);
        
        const result = await pool.query(insertQuery, allValues);
        savedCount = insertFields.length;
        console.log(`✅ Query eseguita con successo. Righe inserite: ${result.rowCount}`);
        
      } else {
        // Utente esistente: aggiorna solo le opinioni specifiche
        const updateQuery = `
          UPDATE opinioni_risposte 
          SET ${updateFields.join(', ')}
          WHERE user_id = $${updateFields.length + 1}
        `;
        
        const allValues = [...insertValues, userId];
        console.log('🔍 DEBUG - Numero parametri UPDATE:', updateFields.length, 'campo WHERE:', updateFields.length + 1);
        console.log('🔍 DEBUG - Utente esistente, aggiorno solo opinioni specifiche');
        console.log('🔍 DEBUG - Query SQL:', updateQuery);
        console.log('🔍 DEBUG - Valori query:', allValues);
        console.log('🔍 DEBUG - Campi da aggiornare:', updateFields);
        
        const result = await pool.query(updateQuery, allValues);
        savedCount = updateFields.length;
        console.log(`✅ Query eseguita con successo. Righe aggiornate: ${result.rowCount}`);
      }
      
      console.log(`✅ Salvate ${savedCount} opinioni per utente ${userId}`);
      
    } catch (error) {
      console.error(`❌ Errore nel salvare opinioni:`, error.message);
      console.error(`❌ Stack trace:`, error.stack);
      console.error(`❌ Code:`, error.code);
      console.error(`❌ Detail:`, error.detail);
      errorCount++;
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

// GET /api/opinioni/:id/approfondimento - Ottieni approfondimento di un'opinione
router.get('/:id/approfondimento', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 GET /api/opinioni/:id/approfondimento - Richiesta approfondimento per opinione:', id);
    
    // Cerca prima per ID diretto (funziona per UUID, ID numerici e ID testuali)
    // Poi fallback per testo se non trovato
    let query = `
      SELECT id, text, approfondimento, gradi_opinione
      FROM opinioni_domande 
      WHERE id = $1
    `;
    let params = [id];
    
    let result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Opinione non trovata per ID, provo con testo:', id);
      // Fallback: prova a cercare per testo (es. energia_nucleare -> "energia nucleare")
      const textToSearch = id.replace(/_/g, ' ');
      const fallbackQuery = `
        SELECT id, text, approfondimento, gradi_opinione
        FROM opinioni_domande 
        WHERE LOWER(TRIM(text)) = LOWER(TRIM($1))
      `;
      result = await pool.query(fallbackQuery, [textToSearch]);
      
      if (result.rows.length === 0) {
        console.log('⚠️ Opinione non trovata nemmeno per testo:', textToSearch);
        return res.status(404).json({
          success: false,
          error: 'Opinione non trovata'
        });
      }
    }
    
    const opinione = result.rows[0];
    
    console.log('✅ Opinione trovata:', {
      id: opinione.id,
      text: opinione.text,
      hasApprofondimento: !!opinione.approfondimento,
      gradi_opinione: opinione.gradi_opinione
    });
    
    res.json({
      success: true,
      data: {
        id: opinione.id,
        text: opinione.text,
        approfondimento: opinione.approfondimento || '',
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
router.put('/:id/approfondimento', verifyToken, async (req, res) => {
  try {
    const { id } = req.params; // ID vecchio (UUID temporaneo)
    const { approfondimento, gradi_opinione, customId } = req.body; // customId = nuovo ID scelto dall'admin
    
    console.log('💾 PUT /api/opinioni/:id/approfondimento - Salvataggio approfondimento per opinione:', id);
    console.log('📋 Dati ricevuti:', { approfondimento, gradi_opinione, customId });
    
    // Verifica che l'utente sia admin
    const userQuery = `
      SELECT ruolo FROM users WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [req.userId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono modificare gli approfondimenti'
      });
    }
    
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
