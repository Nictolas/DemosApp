const express = require('express');
const { pool, verifyToken, requireAdmin, requireAdminOrInstitution } = require('../../middleware/auth');
const { decompressGender, compressGender } = require('../../utils/genderUtils');
const { decompressUserLocation, compressUserLocation } = require('../../utils/locationUtils');

const router = express.Router();

// Mapping per la compressione del ruolo (da frontend a database)
const ruoloCompressionMapping = {
  'Elettore': 'E',
  'Politico': 'P',
  'Candidato': 'C',
  'Candidato Politico': 'CP',
  'Attivista': 'A',
  'Istituzione': 'I',
  'Admin': 'AD'
};

// Mapping per la decompressione del ruolo (da database a frontend)
const ruoloDecompressionMapping = {
  'E': 'Elettore',
  'P': 'Politico', 
  'C': 'Candidato',
  'CP': 'Candidato Politico',
  'A': 'Attivista',
  'I': 'Istituzione',
  'AD': 'Admin'
};

// GET /api/users/search - Ricerca utenti riservata agli amministratori.
// Gli utenti normali scoprono politici/candidati esclusivamente tramite il flusso di matching.
router.get('/search', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        users: []
      });
    }
    
    console.log('🔍 GET /api/users/search - Ricerca utenti per:', q);
    
    const searchQuery = `
      SELECT id, nome, cognome
      FROM users 
      WHERE (nome ILIKE $1 OR cognome ILIKE $1 OR CONCAT(nome, ' ', cognome) ILIKE $1)
      AND status IN ('v', 'a')
      ORDER BY 
        CASE 
          WHEN nome ILIKE $2 THEN 1
          WHEN CONCAT(nome, ' ', cognome) ILIKE $2 THEN 2
          ELSE 3
        END,
        nome, cognome
      LIMIT 10
    `;
    
    const searchTerm = `%${q}%`;
    const exactMatch = `${q}%`;
    
    const result = await pool.query(searchQuery, [searchTerm, exactMatch]);
    
    const users = result.rows.map(user => ({
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      displayName: `${user.nome} ${user.cognome}`.trim()
    }));
    
    console.log(`✅ Trovati ${users.length} utenti per la ricerca`);
    
    res.json({
      success: true,
      users
    });
    
  } catch (error) {
    console.error('❌ Errore nella ricerca utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile cercare gli utenti'
    });
  }
});

// GET /api/users/consiglieri-comunali - Cerca consiglieri comunali per comune_residenza dell'utente operante
router.get('/consiglieri-comunali', verifyToken, requireAdminOrInstitution, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Recupera comune_residenza dell'utente operante
    const userResult = await pool.query(
      'SELECT comune_residenza FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const comuneResidenza = userResult.rows[0].comune_residenza;
    
    if (!comuneResidenza) {
      return res.json({
        success: true,
        consiglieri: []
      });
    }
    
    console.log('🔍 GET /api/users/consiglieri-comunali - Comune residenza:', comuneResidenza);
    
    // Cerca consiglieri comunali con ruolo P, grado_elezione CO e comune_elezione = comune_residenza
    const searchQuery = `
      SELECT id, nome, cognome, comune_elezione
      FROM users 
      WHERE (ruolo = 'P' OR ruolo = 'Politico')
        AND grado_elezione = 'CO'
        AND comune_elezione = $1
        AND status IN ('v', 'a')
      ORDER BY cognome, nome
    `;
    
    const result = await pool.query(searchQuery, [comuneResidenza]);
    
    const consiglieri = result.rows.map(user => ({
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      displayName: `${user.nome} ${user.cognome}`.trim(),
      comune_elezione: user.comune_elezione
    }));
    
    console.log(`✅ Trovati ${consiglieri.length} consiglieri comunali per il comune ${comuneResidenza}`);
    
    res.json({
      success: true,
      consiglieri
    });
    
  } catch (error) {
    console.error('❌ Errore nella ricerca consiglieri comunali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile cercare i consiglieri comunali'
    });
  }
});

// GET /api/users/ - Lista tutti gli utenti (solo admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/ - Lista utenti richiesta da admin');
    
    const { page = 1, limit, search, status, ruolo } = req.query;
    const limitValue = limit ? parseInt(limit) : null; // Se non specificato, restituisce tutti gli utenti
    const offset = limitValue ? (page - 1) * limitValue : 0;
    
    // Costruisci query base
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;
    
    if (search) {
      whereClause += `WHERE (nome ILIKE $${paramIndex} OR cognome ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    if (status) {
      if (whereClause) {
        whereClause += ` AND status = $${paramIndex}`;
      } else {
        whereClause = `WHERE status = $${paramIndex}`;
      }
      queryParams.push(status);
      paramIndex++;
    }
    
    if (ruolo) {
      if (whereClause) {
        whereClause += ` AND ruolo = $${paramIndex}`;
      } else {
        whereClause = `WHERE ruolo = $${paramIndex}`;
      }
      queryParams.push(ruolo);
      paramIndex++;
    }
    
    // Query per contare il totale
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].total);
    
    // Query per gli utenti con paginazione - solo dati essenziali per la tabella
    let usersQuery = `
      SELECT id, name, nome, cognome, email, ruolo, status, created_at, updated_at,
             grado_elezione, grado_candidatura, avatar_config, genere, cittadinanza,
             paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
             data_nascita
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
    `;
    
    let queryParamsWithPagination = [...queryParams];
    
    if (limitValue) {
      usersQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParamsWithPagination.push(limitValue, offset);
    }
    
    const usersResult = await pool.query(usersQuery, queryParamsWithPagination);
    
    // Trasforma i dati per il frontend (solo dati essenziali)
    const users = usersResult.rows.map(user => ({
      ...user,
      genere: decompressGender(user.genere),
      data_nascita: user.data_nascita ? new Date(user.data_nascita).toISOString().split('T')[0] : null
    }));
    
    console.log(`✅ Lista utenti recuperata: ${users.length} su ${totalUsers} totali`);
    
    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: limitValue || totalUsers,
        total: totalUsers,
        pages: limitValue ? Math.ceil(totalUsers / limitValue) : 1
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero lista utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/users/pending - Lista utenti in attesa di approvazione (solo admin)
router.get('/pending', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('⏳ GET /api/users/pending - Lista utenti in attesa richiesta da admin');
    
    const result = await pool.query(`
      SELECT id, nome, cognome, email, ruolo, created_at, avatar_config
      FROM users 
      WHERE (status = 'P' OR status = 'p')
      ORDER BY created_at ASC
    `);
    
    console.log(`✅ Utenti in attesa recuperati: ${result.rows.length}`);
    
    res.json({
      success: true,
      pendingUsers: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero utenti in attesa:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/users/:userId - Ottieni un utente specifico (solo admin)
router.get('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/:userId - Richiesta utente specifico');
    console.log('🔍 DEBUG - URL completa:', req.url);
    console.log('🔍 DEBUG - Params:', req.params);
    console.log('🔍 DEBUG - Query:', req.query);
    
    const { userId } = req.params;
    console.log('🔍 DEBUG - userId ricevuto:', userId);
    
    // Verifica che userId sia valido (UUID o numero)
    if (!userId || (isNaN(parseInt(userId)) && !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
      console.log('❌ DEBUG - userId non valido:', userId);
      return res.status(400).json({
        success: false,
        message: 'ID utente non valido'
      });
    }
    
    console.log('✅ DEBUG - userId valido, procedo con la query');
    
    // Query per ottenere l'utente specifico
    console.log('🔍 DEBUG - Eseguendo query per userId:', userId);
    const result = await pool.query(`
      SELECT id, name, nome, cognome, email, ruolo, status, created_at, updated_at,
             genere, data_nascita, cittadinanza, paese_residenza, regione_residenza,
             provincia_residenza, comune_residenza, avatar_config, grado_elezione, grado_candidatura,
             paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
             paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
             rappresentante_europeo, rappresentante_camera, rappresentante_senato, rappresentante_regionale, rappresentante_comune,
             candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune,
             facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url, website_url, twitch_url, youtube_url
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    console.log('🔍 DEBUG - Query completata, righe trovate:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('❌ DEBUG - Utente non trovato per userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    
    console.log('✅ Utente trovato:', user.email);
    console.log('🔍 DEBUG - Dati utente completi:', {
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
      genere: user.genere,
      ruolo: user.ruolo,
      data_nascita: user.data_nascita,
      cittadinanza: user.cittadinanza
    });
    
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
        // Se è già un oggetto (JSONB dal database), convertilo in stringa JSON
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
    
    const responseData = {
      success: true,
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(user.genere),
        ruolo: ruoloDecompressionMapping[user.ruolo] || user.ruolo,
        avatar_config: avatarConfig
      }
    };
    
    console.log('🔍 DEBUG - Dati di risposta:', {
      success: responseData.success,
      user: {
        id: responseData.user.id,
        nome: responseData.user.nome,
        cognome: responseData.user.cognome,
        email: responseData.user.email,
        genere: decompressGender(responseData.user.genere),
        ruolo: responseData.user.ruolo,
        data_nascita: responseData.user.data_nascita,
        cittadinanza: responseData.user.cittadinanza,
        paese_residenza: responseData.user.paese_residenza,
        regione_residenza: responseData.user.regione_residenza,
        provincia_residenza: responseData.user.provincia_residenza,
        comune_residenza: responseData.user.comune_residenza,
        grado_elezione: responseData.user.grado_elezione,
        paese_elezione: responseData.user.paese_elezione,
        regione_elezione: responseData.user.regione_elezione,
        provincia_elezione: responseData.user.provincia_elezione,
        comune_elezione: responseData.user.comune_elezione,
        grado_candidatura: responseData.user.grado_candidatura,
        paese_candidatura: responseData.user.paese_candidatura,
        regione_candidatura: responseData.user.regione_candidatura,
        provincia_candidatura: responseData.user.provincia_candidatura,
        comune_candidatura: responseData.user.comune_candidatura
      }
    });
    
    // Debug specifico per i dati geografici
    console.log('🔍 DEBUG - Dati geografici specifici:', {
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      provincia_residenza: responseData.user.provincia_residenza,
      comune_residenza: responseData.user.comune_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione,
      provincia_elezione: responseData.user.provincia_elezione,
      comune_elezione: responseData.user.comune_elezione,
      paese_candidatura: responseData.user.paese_candidatura,
      regione_candidatura: responseData.user.regione_candidatura,
      provincia_candidatura: responseData.user.provincia_candidatura,
      comune_candidatura: responseData.user.comune_candidatura
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nel recupero utente specifico:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      error: error.message
    });
  }
});

// PUT /api/users/:userId - Aggiorna utente specifico (solo admin)
router.put('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('✏️ PUT /api/users/:userId - Aggiornamento utente da admin');
    
    const { userId } = req.params;
    const updateData = req.body;
    
    console.log('🔍 DEBUG - userId:', userId);
    console.log('🔍 DEBUG - updateData:', updateData);
    
    // Lista dei campi consentiti per l'aggiornamento
    const allowedFields = [
      'nome', 'cognome', 'genere', 'data_nascita', 'cittadinanza', 'ruolo',
      'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
      'grado_elezione', 'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'grado_candidatura', 'avatar_config',
      'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'telegram_url', 'website_url', 'twitch_url', 'youtube_url'
    ];
    
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
    
    // Filtra solo i campi consentiti e applica compressione/trasformazioni necessarie
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        if (key === 'grado_elezione' || key === 'grado_candidatura') {
          filteredData[key] = normalizeGrado(updateData[key]);
          console.log(`🔧 Grado ${key} normalizzato:`, updateData[key], '→', filteredData[key]);
        } 
        // Applica compressione per il ruolo
        else if (key === 'ruolo') {
          filteredData[key] = ruoloCompressionMapping[updateData[key]] || updateData[key];
          console.log(`🔧 Ruolo compresso:`, updateData[key], '→', filteredData[key]);
        } else {
          filteredData[key] = updateData[key];
        }
      }
    });
    
    // Applica compressione per genere e dati geografici prima di salvare
    if (filteredData.genere) {
      const compressedGenere = compressGender(filteredData.genere);
      if (compressedGenere) {
        filteredData.genere = compressedGenere;
        console.log(`🔧 Genere compresso:`, updateData.genere, '→', compressedGenere);
      } else {
        console.warn(`⚠️ Genere non riconosciuto, non compresso:`, filteredData.genere);
      }
    }
    
    // Applica compressione per i dati geografici
    const compressedLocation = compressUserLocation(filteredData);
    Object.keys(compressedLocation).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = compressedLocation[key];
      }
    });
    
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun campo valido da aggiornare'
      });
    }
    
    // Costruisci SET solo da identificatori SQL costanti già allowlisted.
    const assignments = [];
    const values = [];
      if (Object.prototype.hasOwnProperty.call(filteredData, 'nome')) {
        assignments.push('nome = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.nome);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'cognome')) {
        assignments.push('cognome = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.cognome);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'genere')) {
        assignments.push('genere = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.genere);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'data_nascita')) {
        assignments.push('data_nascita = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.data_nascita);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'cittadinanza')) {
        assignments.push('cittadinanza = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.cittadinanza);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'ruolo')) {
        assignments.push('ruolo = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.ruolo);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'paese_residenza')) {
        assignments.push('paese_residenza = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.paese_residenza);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'regione_residenza')) {
        assignments.push('regione_residenza = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.regione_residenza);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'provincia_residenza')) {
        assignments.push('provincia_residenza = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.provincia_residenza);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'comune_residenza')) {
        assignments.push('comune_residenza = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.comune_residenza);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'paese_elezione')) {
        assignments.push('paese_elezione = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.paese_elezione);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'regione_elezione')) {
        assignments.push('regione_elezione = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.regione_elezione);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'provincia_elezione')) {
        assignments.push('provincia_elezione = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.provincia_elezione);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'comune_elezione')) {
        assignments.push('comune_elezione = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.comune_elezione);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'grado_elezione')) {
        assignments.push('grado_elezione = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.grado_elezione);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'paese_candidatura')) {
        assignments.push('paese_candidatura = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.paese_candidatura);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'regione_candidatura')) {
        assignments.push('regione_candidatura = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.regione_candidatura);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'provincia_candidatura')) {
        assignments.push('provincia_candidatura = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.provincia_candidatura);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'comune_candidatura')) {
        assignments.push('comune_candidatura = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.comune_candidatura);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'grado_candidatura')) {
        assignments.push('grado_candidatura = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.grado_candidatura);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'avatar_config')) {
        assignments.push('avatar_config = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.avatar_config);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'facebook_url')) {
        assignments.push('facebook_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.facebook_url);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'twitter_url')) {
        assignments.push('twitter_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.twitter_url);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'instagram_url')) {
        assignments.push('instagram_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.instagram_url);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'linkedin_url')) {
        assignments.push('linkedin_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.linkedin_url);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'telegram_url')) {
        assignments.push('telegram_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.telegram_url);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'website_url')) {
        assignments.push('website_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.website_url);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'twitch_url')) {
        assignments.push('twitch_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.twitch_url);
      }
      if (Object.prototype.hasOwnProperty.call(filteredData, 'youtube_url')) {
        assignments.push('youtube_url = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1));
        values.push(filteredData.youtube_url);
      }
    const query = 'UPDATE users SET ' + assignments.join(', ') + ', updated_at = NOW() WHERE id = 
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
 + (values.length + 1) + ' RETURNING *';
    
    const result = await pool.query(query, [...values, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Utente aggiornato:', updatedUser.email);
    
    // Formatta la data di nascita per la risposta (formato europeo DD/MM/YYYY)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    // Applica decompressione per i dati geografici e genere
    const decompressedUser = decompressUserLocation(updatedUser);
    
    const responseData = {
      success: true,
      message: 'Utente aggiornato con successo',
      user: {
        ...decompressedUser,
        data_nascita: dataNascitaFormattata,
        genere: decompressGender(updatedUser.genere),
        ruolo: ruoloDecompressionMapping[updatedUser.ruolo] || updatedUser.ruolo
      }
    };
    
    console.log('🔍 DEBUG - Dati utente aggiornati restituiti:', {
      id: responseData.user.id,
      nome: responseData.user.nome,
      cognome: responseData.user.cognome,
      email: responseData.user.email,
      genere: responseData.user.genere,
      ruolo: responseData.user.ruolo,
      paese_residenza: responseData.user.paese_residenza,
      regione_residenza: responseData.user.regione_residenza,
      paese_elezione: responseData.user.paese_elezione,
      regione_elezione: responseData.user.regione_elezione
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento utente:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
