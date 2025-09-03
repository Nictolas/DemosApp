const express = require('express');
const { pool } = require('../../middleware/auth');
const { verifyToken } = require('../../middleware/auth');

const router = express.Router();

// GET /api/users/me - Ottieni profilo utente autenticato
router.get('/me', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/me - Richiesta profilo utente');
    
    const userId = req.user.id;
    
    // Recupera dati utente completi
    const result = await pool.query(`
      SELECT id, email, nome, cognome, genere, data_nascita, cittadinanza, 
             paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
             ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
             grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
             status, avatar_config, created_at, updated_at
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
router.post('/me/avatar', verifyToken, async (req, res) => {
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
router.put('/me', verifyToken, async (req, res) => {
  try {
    console.log('✏️ PUT /api/users/me - Aggiornamento profilo utente');
    
    const userId = req.user.id;
    const updateData = req.body;
    
    // Lista dei campi consentiti per l'aggiornamento
    const allowedFields = [
      'nome', 'cognome', 'genere', 'data_nascita', 'cittadinanza',
      'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
      'grado_elezione', 'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'grado_candidatura'
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

// PUT /api/users/:userId/seleziona-rappresentante - Seleziona rappresentante per categoria
router.put('/:userId/seleziona-rappresentante', verifyToken, async (req, res) => {
  try {
    console.log('🎯 PUT /api/users/:userId/seleziona-rappresentante - Selezione rappresentante');
    
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
    const validFields = ['rappresentante_europeo', 'rappresentante_camera', 'rappresentante_senato', 'rappresentante_regionale', 'rappresentante_comune'];
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
    
    console.log('✅ Rappresentante selezionato con successo');
    
    res.json({
      success: true,
      message: 'Rappresentante selezionato con successo',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore nella selezione rappresentante:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/users/:userId/opinioni - Ottieni opinioni di un utente specifico
router.get('/:userId/opinioni', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/:userId/opinioni - Richiesta opinioni utente');
    
    const { userId } = req.params;
    const { grado } = req.query; // Parametro opzionale per filtrare per grado
    
    // Verifica che l'utente autenticato possa accedere a questi dati
    const authenticatedUserId = req.userId;
    
    // Carica le opinioni specifiche per il grado (se specificato) dalla tabella opinioni
    let opinioniQuery = `
      SELECT o.id, o.text, o.gradi_opinione, o.source, o.fonte_url
      FROM opinioni o
    `;
    let opinioniParams = [];
    
    if (grado) {
      opinioniQuery += ` WHERE $1 = ANY(o.gradi_opinione)`;
      opinioniParams.push(grado);
    }
    
    opinioniQuery += ` ORDER BY o.text`;
    
    const opinioniResult = await pool.query(opinioniQuery, opinioniParams);
    const opinioni = opinioniResult.rows;
    
    console.log('🔍 DEBUG - Opinion caricate:', opinioni.length);
    if (grado) {
      console.log('🔍 DEBUG - Filtro grado applicato:', grado);
    }
    
    // Carica le opinioni dell'utente specifico
    const userOpinionsQuery = `
      SELECT 
        -- Opinion nazionali
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali
        comunale_cassonetti_intelligenti_con_tessera, comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        comunale_divieto_di_nuovi_fast_food_nel_centro_storico, comunale_estensione_delle_zone_a_traffico_limitato,
        comunale_finanziamento_eventi_culturali_gratuiti, comunale_nuova_biblioteca_comunale,
        comunale_nuove_case_popolari, comunale_nuove_piste_ciclabili, comunale_nuovi_asili_nido_comunali,
        comunale_nuovo_stadio_comunale, comunale_parcheggi_gratuiti_per_residenti,
        comunale_potenziamento_trasporto_pubblico, comunale_riduzione_tasse_rifiuti,
        comunale_sicurezza_strade_scolastiche, comunale_sostegno_commercio_locale,
        comunale_verde_pubblico_e_giardini,
        -- Opinion regionali
        regionale_nuovi_inceneritori, regionale_chiusura_ospedali_di_provincia,
        -- Fonti delle opinioni
        fonti_opinioni
      FROM users
      WHERE id = $1
    `;
    
    const userOpinionsResult = await pool.query(userOpinionsQuery, [userId]);
    const userOpinions = userOpinionsResult.rows[0] || {};
    
    if (!userOpinionsResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Estrai le fonti delle opinioni
    const fontiOpinioni = userOpinions.fonti_opinioni || {};
    console.log('🔍 DEBUG - Fonti opinioni per utente', userId, ':', fontiOpinioni);
    
    // Formatta le opinioni per il frontend
    const formattedOpinions = opinioni.map(opinion => {
      const fieldName = opinion.text.toLowerCase().replace(/\s+/g, '_');
      const userAnswer = userOpinions[fieldName];
      
      // Debug log per capire i valori
      if (fieldName === 'carne_coltivata') {
        console.log('🔍 DEBUG - carne_coltivata per utente', userId, ':', userAnswer, 'tipo:', typeof userAnswer);
      }
      
      // Le risposte sono già nel formato frontend: "Favorevole", "Indeciso", "Contrario", "Astenuto"
      let frontendAnswer = userAnswer;
      if (userAnswer === null || userAnswer === 'null') frontendAnswer = 'Astenuto';
      
      return {
        id: fieldName,
        text: opinion.text,
        grado: opinion.gradi_opinione,
        userAnswer: frontendAnswer
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

module.exports = router;
