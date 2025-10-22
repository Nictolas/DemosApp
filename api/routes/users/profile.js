const express = require('express');
const { pool, verifyToken, requireAdmin } = require('../../middleware/auth');
const { userDataAuditMiddleware } = require('../../middleware/auditMiddleware');
const { decompressUserOpinions, compressUserOpinions, getOpinionColumns } = require('../../utils/opinionUtils');

const router = express.Router();

// GET /api/users/me - Ottieni profilo utente autenticato
router.get('/me', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/me - Richiesta profilo utente');
    
    const userId = req.user.id;
    
    // Recupera dati utente completi
    const result = await pool.query(`
      SELECT id, email, nome, cognome, genere, data_nascita, cittadinanza, 
             paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
             ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
             grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
             status, avatar_config, created_at, updated_at,
             facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url, website_url, twitch_url, youtube_url
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    console.log('✅ Profilo utente recuperato:', user.email);
    
    // Formatta la data di nascita per il frontend (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (user.data_nascita) {
      const data = new Date(user.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Gestisci avatar_config - se è una stringa JSON valida, mantienila, altrimenti imposta null
    let avatarConfig = null;
    if (user.avatar_config) {
      try {
        // Verifica se è già un JSON valido
        JSON.parse(user.avatar_config);
        avatarConfig = user.avatar_config;
      } catch (e) {
        // Se non è JSON valido, imposta null
        avatarConfig = null;
      }
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        genere: user.genere,
        data_nascita: dataNascitaFormattata,
        cittadinanza: user.cittadinanza,
        paese_residenza: user.paese_residenza,
        regione_residenza: user.regione_residenza,
        provincia_residenza: user.provincia_residenza,
        comune_residenza: user.comune_residenza,
        ruolo: user.ruolo,
        grado_elezione: user.grado_elezione,
        paese_elezione: user.paese_elezione,
        regione_elezione: user.regione_elezione,
        provincia_elezione: user.provincia_elezione,
        comune_elezione: user.comune_elezione,
        grado_candidatura: user.grado_candidatura,
        paese_candidatura: user.paese_candidatura,
        regione_candidatura: user.regione_candidatura,
        provincia_candidatura: user.provincia_candidatura,
        comune_candidatura: user.comune_candidatura,
        status: user.status,
        avatar_config: avatarConfig,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/users/me/avatar - Aggiorna configurazione avatar
router.post('/me/avatar', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatar_config } = req.body;
    
    console.log('🎨 POST /api/users/me/avatar - Aggiornamento avatar per utente:', userId);
    
    if (!avatar_config) {
      return res.status(400).json({
        success: false,
        error: 'Configurazione avatar richiesta'
      });
    }
    
    // Aggiorna la configurazione avatar
    const result = await pool.query(
      'UPDATE users SET avatar_config = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_config',
      [avatar_config, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ Avatar aggiornato per utente:', userId);
    
    res.json({
      success: true,
      message: 'Avatar aggiornato con successo',
      avatar_config: result.rows[0].avatar_config
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/users/me - Aggiorna profilo utente autenticato
router.put('/me', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    console.log('✏️ PUT /api/users/me - Aggiornamento profilo utente');
    
    const userId = req.user.id;
    const updateData = req.body;
    
    // Lista dei campi consentiti per l'aggiornamento
    const allowedFields = [
      'nome', 'cognome', 'genere', 'data_nascita', 'cittadinanza', 'ruolo',
      'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
      'grado_elezione', 'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'grado_candidatura',
      'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'telegram_url', 'website_url', 'twitch_url', 'youtube_url'
    ];
    
    // Filtra solo i campi consentiti
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        filteredData[key] = updateData[key];
      }
    });
    
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun campo valido da aggiornare'
      });
    }
    
    // Costruisci la query di aggiornamento dinamicamente
    const setClause = Object.keys(filteredData).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(filteredData);
    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Profilo utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    res.json({
      success: true,
      message: 'Profilo aggiornato con successo',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        nome: updatedUser.nome,
        cognome: updatedUser.cognome,
        genere: updatedUser.genere,
        data_nascita: dataNascitaFormattata,
        cittadinanza: updatedUser.cittadinanza,
        paese_residenza: updatedUser.paese_residenza,
        regione_residenza: updatedUser.regione_residenza,
        provincia_residenza: updatedUser.provincia_residenza,
        comune_residenza: updatedUser.comune_residenza,
        ruolo: updatedUser.ruolo,
        grado_elezione: updatedUser.grado_elezione,
        paese_elezione: updatedUser.paese_elezione,
        regione_elezione: updatedUser.regione_elezione,
        provincia_elezione: updatedUser.provincia_elezione,
        comune_elezione: updatedUser.comune_elezione,
        grado_candidatura: updatedUser.grado_candidatura,
        paese_candidatura: updatedUser.paese_candidatura,
        regione_candidatura: updatedUser.regione_candidatura,
        provincia_candidatura: updatedUser.provincia_candidatura,
        comune_candidatura: updatedUser.comune_candidatura,
        status: updatedUser.status,
        avatar_config: updatedUser.avatar_config,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/users/:userId/seleziona-rappresentante - Seleziona rappresentante o candidato per categoria
router.put('/:userId/seleziona-rappresentante', verifyToken, async (req, res) => {
  try {
    console.log('🎯 PUT /api/users/:userId/seleziona-rappresentante - Selezione rappresentante/candidato');
    
    const { userId } = req.params;
    const { campo, rappresentanteId } = req.body;
    const authenticatedUserId = req.userId; // ID dell'utente autenticato dal token
    
    console.log('🔍 DEBUG - userId dal parametro:', userId);
    console.log('🔍 DEBUG - authenticatedUserId dal token:', authenticatedUserId);
    console.log('🔍 DEBUG - campo:', campo);
    console.log('🔍 DEBUG - rappresentanteId:', rappresentanteId);
    
    // Verifica che l'utente autenticato possa modificare questo profilo
    if (authenticatedUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato a modificare questo profilo'
      });
    }
    
    // Verifica che il campo sia valido
    const validFields = [
      'rappresentante_europeo', 'rappresentante_camera', 'rappresentante_senato', 'rappresentante_regionale', 'rappresentante_comune',
      'candidato_europeo', 'candidato_camera', 'candidato_senato', 'candidato_regionale', 'candidato_comune'
    ];
    if (!validFields.includes(campo)) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido'
      });
    }
    
    // Aggiorna il campo del rappresentante
    const query = `UPDATE users SET ${campo} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [rappresentanteId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const isCandidato = campo.startsWith('candidato_');
    const entityType = isCandidato ? 'Candidato' : 'Rappresentante';
    
    console.log(`✅ ${entityType} selezionato con successo`);
    
    res.json({
      success: true,
      message: `${entityType} selezionato con successo`,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore nella selezione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});


// GET /api/users/:userId/opinioni - Ottieni opinioni di un utente specifico
router.get('/:userId/opinioni', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/:userId/opinioni - Richiesta opinioni utente');
    
    const { userId } = req.params;
    const { grado } = req.query; // Parametro opzionale per filtrare per grado
    
    // Verifica che l'utente autenticato possa accedere a questi dati
    const authenticatedUserId = req.userId;
    
    // Carica le opinioni specifiche per il grado (se specificato) dalla tabella opinioni_domande
    let opinioniQuery = `
      SELECT id, text, gradi_opinione, informazioni, approfondimenti
      FROM opinioni_domande
    `;
    
    // Filtra per grado se specificato
    if (grado) {
      opinioniQuery += ` WHERE $1 = ANY(gradi_opinione)`;
    }
    
    opinioniQuery += ` ORDER BY text`;
    
    // Esegui la query per le opinioni
    let opinioniResult;
    if (grado) {
      opinioniResult = await pool.query(opinioniQuery, [grado]);
    } else {
      opinioniResult = await pool.query(opinioniQuery);
    }
    const opinioni = opinioniResult.rows;
    
    // Carica le risposte dell'utente dalla tabella opinioni_risposte
    const userAnswersQuery = `SELECT * FROM opinioni_risposte WHERE user_id = $1`;
    const userAnswersResult = await pool.query(userAnswersQuery, [userId]);
    const userAnswers = userAnswersResult.rows[0] || {};
    
    console.log('🔍 DEBUG - Opinion caricate:', opinioni.length);
    if (grado) {
      console.log('🔍 DEBUG - Filtro grado applicato:', grado);
    }
    
    // Verifica che l'utente esista
    const userCheckResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!userCheckResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Estrai le fonti dalle opinioni dell'utente
    const fontiOpinioni = userAnswers.fonti_opinioni || {};
    console.log('🔍 DEBUG - Fonti opinioni per utente', userId, ':', fontiOpinioni);
    
    // Formatta le opinioni per il frontend usando il mapping diretto
    const formattedOpinions = opinioni.map(opinion => {
      const opinionId = opinion.id; // Usa l'ID diretto dalla tabella opinioni_domande
      const userAnswer = userAnswers[opinionId] || null; // Prende il valore dalla colonna corrispondente
      
      console.log(`🔍 DEBUG - Opinione:`, {
        id: opinionId,
        text: opinion.text,
        userAnswer: userAnswer
      });
      
      // Restituisci sempre valori compressi per compatibilità
      let frontendAnswer = null;
      if (userAnswer === 'f') frontendAnswer = 'f';
      else if (userAnswer === 'c') frontendAnswer = 'c';
      else if (userAnswer === 'i') frontendAnswer = 'i';
      else if (userAnswer === null) frontendAnswer = null;
      // Gestisci valori legacy convertendoli a compressi
      else if (userAnswer === 'Sì' || userAnswer === 'Favorevole') frontendAnswer = 'f';
      else if (userAnswer === 'No' || userAnswer === 'Contrario') frontendAnswer = 'c';
      else if (userAnswer === 'Indeciso') frontendAnswer = 'i';
      
      return {
        id: opinionId,
        text: opinion.text,
        grado: opinion.gradi_opinione,
        userAnswer: frontendAnswer,
        source: fontiOpinioni[opinionId] || 'unknown'
      };
    });
    
    console.log(`✅ Trovate ${formattedOpinions.length} opinioni per utente ${userId}`);
    
    res.json({
      success: true,
      data: {
        opinioni: formattedOpinions,
        fonti: fontiOpinioni,
        utenteId: userId,
        grado: grado || 'tutti'
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni'
    });
  }
});

// PUT /api/users/:userId/opinioni - Salva le opinioni di un utente specifico (solo admin)
router.put('/:userId/opinioni', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('💾 PUT /api/users/:userId/opinioni - Salvataggio opinioni utente da admin');
    
    const { userId } = req.params;
    const { opinioni, fonti } = req.body;
    
    console.log('👤 User ID:', userId);
    console.log('📋 Opinion ricevute:', opinioni);
    console.log('🔗 Fonti ricevute:', fonti);
    
    if (!opinioni || typeof opinioni !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti',
        message: 'Il campo opinioni è obbligatorio'
      });
    }
    
    // Mappa delle opinioni ai campi del database
    const opinionMapping = {
      // Opinion nazionali/europee
      'energia_nucleare': 'energia_nucleare',
      'sperimentazione_animale': 'sperimentazione_animale',
      'legalizzazione_canapa': 'legalizzazione_canapa',
      'caccia': 'caccia',
      'eutanasia': 'eutanasia',
      'carne_coltivata': 'carne_coltivata',
      'cittadina_animale': 'cittadina_animale',
      'nato': 'nato',
      'matrimonio_gay': 'matrimonio_gay',
      'salario_minimo': 'salario_minimo',
      'case_chiuse': 'case_chiuse',
      'omobitransfobia': 'omobitransfobia',
      
      // Opinion comunali (senza prefissi)
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
      
      // Opinion regionali (senza prefissi)
      'nuovi_inceneritori': 'nuovi_inceneritori',
      'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
      
      // Opinion nazionali/comunali (senza prefissi)
      'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
      'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
      'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
      'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
      'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento'
    };
    
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    // Processa le opinioni
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      const dbField = opinionMapping[opinionId];
      
      if (dbField) {
        let dbValue = null;
        if (risposta === 'Favorevole') dbValue = 'f';
        else if (risposta === 'Contrario') dbValue = 'c';
        else if (risposta === 'Indeciso') dbValue = 'i';
        else if (risposta === 'Astenuto') dbValue = null;
        
        updateFields.push(`${dbField} = $${paramIndex}`);
        updateValues.push(dbValue);
        paramIndex++;
      }
    }
    
    // Processa le fonti se fornite
    if (fonti && typeof fonti === 'object') {
      updateFields.push(`fonti_opinioni = $${paramIndex}`);
      updateValues.push(JSON.stringify(fonti));
      paramIndex++;
    }
    
    // Aggiungi updated_at
    updateFields.push(`updated_at = $${paramIndex}`);
    updateValues.push(new Date());
    paramIndex++;
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    // Esegui l'UPDATE
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `;
    
    updateValues.push(userId);
    
    const result = await pool.query(updateQuery, updateValues);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Impossibile aggiornare le opinioni'
      });
    }
    
    console.log('✅ Opinion salvate con successo per utente:', userId);
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      updatedFields: updateFields.length - 1, // -1 per escludere updated_at
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvare opinioni utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile salvare le opinioni'
    });
  }
});


module.exports = router;
