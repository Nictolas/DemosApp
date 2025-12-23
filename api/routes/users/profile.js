const express = require('express');
const { pool, verifyToken, requireAdmin } = require('../../middleware/auth');
const { userDataAuditMiddleware } = require('../../middleware/auditMiddleware');
const { decompressUserOpinions, compressUserOpinions, getOpinionColumns } = require('../../utils/opinionUtils');
const { compressUserLocation, decompressUserLocation } = require('../../utils/locationUtils');
const { decompressGender } = require('../../utils/genderUtils');

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
             rappresentante_europeo, rappresentante_camera, rappresentante_senato, rappresentante_regionale, rappresentante_comune,
             candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune,
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
    
    // Gestisci avatar_config - può essere un oggetto JSONB o una stringa JSON
    let avatarConfig = null;
    if (user.avatar_config) {
      try {
        // Se è già un oggetto (JSONB dal database), usalo direttamente
        if (typeof user.avatar_config === 'object' && user.avatar_config !== null) {
          avatarConfig = JSON.stringify(user.avatar_config);
        } 
        // Se è una stringa, verifica che sia JSON valido
        else if (typeof user.avatar_config === 'string') {
          // Verifica se è già un JSON valido
          JSON.parse(user.avatar_config);
          avatarConfig = user.avatar_config;
        }
      } catch (e) {
        console.warn('⚠️ Errore nella gestione avatar_config:', e);
        // Se non è JSON valido, imposta null
        avatarConfig = null;
      }
    }
    
    // Applica decompressione per i dati geografici
    const decompressedUser = decompressUserLocation(user);
    
    res.json({
      success: true,
      user: {
        id: decompressedUser.id,
        email: decompressedUser.email,
        nome: decompressedUser.nome,
        cognome: decompressedUser.cognome,
        genere: decompressGender(decompressedUser.genere),
        data_nascita: dataNascitaFormattata,
        cittadinanza: decompressedUser.cittadinanza,
        paese_residenza: decompressedUser.paese_residenza,
        regione_residenza: decompressedUser.regione_residenza,
        provincia_residenza: decompressedUser.provincia_residenza,
        comune_residenza: decompressedUser.comune_residenza,
        ruolo: decompressedUser.ruolo,
        grado_elezione: decompressedUser.grado_elezione,
        paese_elezione: decompressedUser.paese_elezione,
        regione_elezione: decompressedUser.regione_elezione,
        provincia_elezione: decompressedUser.provincia_elezione,
        comune_elezione: decompressedUser.comune_elezione,
        grado_candidatura: decompressedUser.grado_candidatura,
        paese_candidatura: decompressedUser.paese_candidatura,
        regione_candidatura: decompressedUser.regione_candidatura,
        provincia_candidatura: decompressedUser.provincia_candidatura,
        comune_candidatura: decompressedUser.comune_candidatura,
        rappresentante_europeo: decompressedUser.rappresentante_europeo,
        rappresentante_camera: decompressedUser.rappresentante_camera,
        rappresentante_senato: decompressedUser.rappresentante_senato,
        rappresentante_regionale: decompressedUser.rappresentante_regionale,
        rappresentante_comune: decompressedUser.rappresentante_comune,
        candidato_europeo: decompressedUser.candidato_europeo,
        candidato_camera: decompressedUser.candidato_camera,
        candidato_senato: decompressedUser.candidato_senato,
        candidato_regionale: decompressedUser.candidato_regionale,
        candidato_comune: decompressedUser.candidato_comune,
        status: decompressedUser.status,
        avatar_config: avatarConfig,
        created_at: decompressedUser.created_at,
        updated_at: decompressedUser.updated_at,
        facebook_url: decompressedUser.facebook_url,
        twitter_url: decompressedUser.twitter_url,
        instagram_url: decompressedUser.instagram_url,
        linkedin_url: decompressedUser.linkedin_url,
        telegram_url: decompressedUser.telegram_url,
        website_url: decompressedUser.website_url,
        twitch_url: decompressedUser.twitch_url,
        youtube_url: decompressedUser.youtube_url
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
    
    // Compressione ruolo
    const ruoloMapping = {
      'Elettore': 'E',
      'Politico': 'P',
      'Candidato': 'C',
      'Candidato Politico': 'CP',
      'Attivista': 'A',
      'Istituzione': 'I',
      'Admin': 'AD'
    };
    
    // Normalizza i gradi di elezione e candidatura (tutto maiuscolo)
    const normalizeGrado = (grado) => {
      // Se è null o undefined, restituisci null (per permettere la cancellazione)
      if (grado === null || grado === undefined) return null;
      // Se non è una stringa, restituisci il valore originale
      if (typeof grado !== 'string') return grado;
      // Se è una stringa vuota, restituisci null
      if (grado.trim() === '') return null;
      // I valori validi sono: CO, P, R, N, C, S, E (tutti maiuscoli)
      return grado.toUpperCase();
    };
    
    // Filtra solo i campi consentiti e applica compressione per i dati geografici e ruolo
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        // Normalizza i gradi di elezione e candidatura
        if (key === 'grado_elezione' || key === 'grado_candidatura') {
          filteredData[key] = normalizeGrado(updateData[key]);
          console.log(`🔧 Grado ${key} normalizzato:`, updateData[key], '→', filteredData[key]);
        }
        // Applica compressione per i campi paese
        else if (key === 'paese_residenza' || key === 'paese_elezione' || key === 'paese_candidatura') {
          const compressedValue = compressUserLocation({ [key]: updateData[key] })[key];
          filteredData[key] = compressedValue;
        } 
        // Applica compressione per le regioni
        else if (key === 'regione_residenza' || key === 'regione_elezione' || key === 'regione_candidatura') {
          const compressedValue = compressUserLocation({ [key]: updateData[key] })[key];
          filteredData[key] = compressedValue;
        }
        // Applica compressione per le province
        else if (key === 'provincia_residenza' || key === 'provincia_elezione' || key === 'provincia_candidatura') {
          const compressedValue = compressUserLocation({ [key]: updateData[key] })[key];
          filteredData[key] = compressedValue;
        }
        // Applica compressione per il ruolo
        else if (key === 'ruolo') {
          filteredData[key] = ruoloMapping[updateData[key]] || updateData[key];
        } else {
          filteredData[key] = updateData[key];
        }
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
      SELECT id, text, gradi_opinione, approfondimento
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
    
    // Verifica che l'utente esista
    const userCheckResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!userCheckResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Impossibile aggiornare le opinioni'
      });
    }
    
    // Verifica che gli ID delle opinioni esistano in opinioni_domande
    // e ottieni la lista delle colonne valide in opinioni_risposte
    const validOpinionsResult = await pool.query('SELECT id FROM opinioni_domande');
    const validOpinionIds = new Set(validOpinionsResult.rows.map(row => row.id));
    
    // Ottieni anche le colonne esistenti in opinioni_risposte per validazione
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' 
      AND column_name != 'user_id' 
      AND column_name != 'fonti_opinioni'
    `);
    const validColumns = new Set(columnsResult.rows.map(row => row.column_name));
    
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    // Processa le opinioni - usa direttamente l'ID come nome colonna
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      // Verifica che l'ID esista in opinioni_domande e che la colonna esista in opinioni_risposte
      if (!validOpinionIds.has(opinionId)) {
        console.warn(`⚠️ Opinione ID non valido ignorato: ${opinionId}`);
        continue;
      }
      
      if (!validColumns.has(opinionId)) {
        console.warn(`⚠️ Colonna non trovata in opinioni_risposte ignorata: ${opinionId}`);
        continue;
      }
      
      // Usa direttamente l'ID come nome della colonna
      const dbField = opinionId;
      let dbValue = null;
      // Accetta sia il formato leggibile che quello del database
      if (risposta === 'Favorevole' || risposta === 'f') dbValue = 'f';
      else if (risposta === 'Contrario' || risposta === 'c') dbValue = 'c';
      else if (risposta === 'Indeciso' || risposta === 'i') dbValue = 'i';
      else if (risposta === 'Astenuto' || risposta === null || risposta === undefined || risposta === '') dbValue = null;
      else {
        // Se il valore non è riconosciuto, usa il valore così com'è (potrebbe già essere nel formato corretto)
        dbValue = risposta;
      }
      
      updateFields.push(`${dbField} = $${paramIndex}`);
      updateValues.push(dbValue);
      paramIndex++;
      console.log(`✅ Processata opinione: ${opinionId} (${dbField}) = ${dbValue}`);
    }
    
    // Processa le fonti se fornite
    let fontiFinali = {};
    if (fonti && typeof fonti === 'object') {
      // Carica le fonti esistenti
      const existingResult = await pool.query(
        'SELECT fonti_opinioni FROM opinioni_risposte WHERE user_id = $1',
        [userId]
      );
      
      if (existingResult.rows[0] && existingResult.rows[0].fonti_opinioni) {
        fontiFinali = existingResult.rows[0].fonti_opinioni;
      }
      
      // Aggiorna con le nuove fonti - usa direttamente l'ID come chiave nel JSON
      Object.entries(fonti).forEach(([opinionId, fonte]) => {
        // Verifica che l'ID sia valido e che la fonte non sia vuota
        if (validOpinionIds.has(opinionId) && fonte && fonte.trim() !== '') {
          fontiFinali[opinionId] = fonte;
        } else if (validOpinionIds.has(opinionId) && (!fonte || fonte.trim() === '')) {
          // Rimuovi la fonte se è vuota
          delete fontiFinali[opinionId];
        }
      });
      
      // Per JSONB, PostgreSQL accetta direttamente l'oggetto JavaScript
      updateFields.push(`fonti_opinioni = $${paramIndex}::jsonb`);
      updateValues.push(JSON.stringify(fontiFinali));
      paramIndex++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    // Controlla se l'utente ha già delle risposte nella tabella opinioni_risposte
    const checkResult = await pool.query(
      'SELECT user_id FROM opinioni_risposte WHERE user_id = $1',
      [userId]
    );
    
    let result;
    if (checkResult.rows.length === 0) {
      // Prima volta: inserisci tutte le opinioni
      const insertFields = updateFields.map(field => field.split(' = ')[0]);
      const insertPlaceholders = updateFields.map((_, i) => `$${i + 2}`).join(', ');
      const insertQuery = `
        INSERT INTO opinioni_risposte (user_id, ${insertFields.join(', ')})
        VALUES ($1, ${insertPlaceholders})
      `;
      const allValues = [userId, ...updateValues];
      
      console.log('📝 Query SQL INSERT:', insertQuery);
      console.log('📝 Valori:', allValues);
      
      result = await pool.query(insertQuery, allValues);
    } else {
      // Utente esistente: aggiorna solo le opinioni specifiche
      updateValues.push(userId);
      const updateQuery = `
        UPDATE opinioni_risposte 
        SET ${updateFields.join(', ')}
        WHERE user_id = $${updateValues.length}
      `;
      
      console.log('📝 Query SQL UPDATE:', updateQuery);
      console.log('📝 Valori:', updateValues);
      
      result = await pool.query(updateQuery, updateValues);
    }
    
    if (result.rowCount === 0 && checkResult.rows.length > 0) {
      return res.status(404).json({
        success: false,
        error: 'Record non trovato',
        message: 'Impossibile aggiornare le opinioni'
      });
    }
    
    console.log('✅ Opinion salvate con successo per utente:', userId);
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      updatedFields: updateFields.length - (fonti && typeof fonti === 'object' ? 1 : 0),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvare opinioni utente:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Dettagli errore:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile salvare le opinioni',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


module.exports = router;
