const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/candidati - Ottieni selezioni candidati dell'utente corrente
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/candidati - Richiesta ricevuta per userId:', userId);
    
    // Ottieni i dati dell'utente con le selezioni candidati
    const userQuery = `
      SELECT 
        id,
        nome,
        cognome,
        email,
        ruolo,
        status,
        avatar_config,
        candidato_europeo,
        candidato_camera,
        candidato_senato,
        candidato_regionale,
        candidato_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('🔍 DEBUG - Utente trovato:', user.nome, user.cognome);
    
    // Inizializza le strutture dati
    const candidatiSelezionati = {};
    const idMap = {};
    
    // Campi candidati da controllare
    const campiCandidati = [
      { campo: 'candidato_europeo', categoria: 'europeo' },
      { campo: 'candidato_camera', categoria: 'camera' },
      { campo: 'candidato_senato', categoria: 'senato' },
      { campo: 'candidato_regionale', categoria: 'regione' },
      { campo: 'candidato_comune', categoria: 'comune' }
    ];
    
    for (const { campo, categoria } of campiCandidati) {
      const candidatoId = user[campo];
      
      if (candidatoId) {
        // Cerca il candidato selezionato (rimuoviamo il filtro ruolo per trovare tutti gli utenti)
        const candidatoQuery = `
          SELECT 
            id,
            nome,
            cognome,
            email,
            ruolo,
            status,
            avatar_config,
            grado_candidatura
          FROM users
          WHERE id::text = $1
        `;
        
        console.log(`🔍 DEBUG - Cercando candidato con ID: ${candidatoId} per categoria: ${categoria}`);
        const candidatoResult = await pool.query(candidatoQuery, [candidatoId]);
        console.log(`🔍 DEBUG - Risultato query candidato:`, candidatoResult.rows.length, 'righe trovate');
        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          candidatiSelezionati[categoria] = [candidato];
          idMap[categoria] = candidatoId;
          console.log(`🔍 DEBUG - Candidato selezionato per ${categoria}:`, candidato.nome, candidato.cognome);
        } else {
          console.log(`❌ DEBUG - Nessun candidato trovato per ID: ${candidatoId} e categoria: ${categoria}`);
        }
      }
    }
    
    console.log('🔍 DEBUG - Candidati selezionati finali:', candidatiSelezionati);
    console.log('🔍 DEBUG - ID Map finale:', idMap);
    
    res.json({
      success: true,
      data: {
        candidati: candidatiSelezionati,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare selezioni candidati utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare selezioni candidati utente'
    });
  }
});

// GET /api/candidati/sostenitori - Ottieni sostenitori candidati di un utente
router.get('/sostenitori', async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    // Trova tutti gli utenti che hanno scelto questo utente come candidato
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cognome,
        u.email,
        u.ruolo,
        u.data_nascita,
        u.genere,
        u.regione_residenza,
        u.provincia_residenza,
        u.comune_residenza,
        u.created_at,
        CASE 
          WHEN u.candidato_europeo = $1 THEN 'Candidato Europeo'
          WHEN u.candidato_camera = $1 THEN 'Candidato Camera'
          WHEN u.candidato_senato = $1 THEN 'Candidato Senato'
          WHEN u.candidato_regionale = $1 THEN 'Candidato Regionale'
          WHEN u.candidato_comune = $1 THEN 'Candidato Comunale'
        END as supporter_role
      FROM users u
      WHERE (
        u.candidato_europeo = $1 OR
        u.candidato_camera = $1 OR
        u.candidato_senato = $1 OR
        u.candidato_regionale = $1 OR
        u.candidato_comune = $1
      )
      AND u.status = 'attivo'
      ORDER BY u.created_at DESC
    `, [sostenuto_id]);

    const sostenitori = result.rows;

    res.json({
      success: true,
      data: {
        sostenitori: sostenitori,
        count: sostenitori.length
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare sostenitori candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sostenitori candidati'
    });
  }
});

// GET /api/candidati/disponibili - Ottieni candidati disponibili per grado_candidatura
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado_candidatura } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/candidati/disponibili - Richiesta ricevuta:', { grado_candidatura, userId });
    
    if (!grado_candidatura) {
      return res.status(400).json({
        success: false,
        error: 'Parametro grado_candidatura richiesto'
      });
    }
    
    // Query per ottenere utenti con ruolo "Candidato" o "Candidato Politico" 
    // e grado_candidatura corrispondente, limitato a massimo 4 risultati
    const candidatiQuery = `
      SELECT 
        id,
        nome,
        cognome,
        email,
        ruolo,
        status,
        avatar_config,
        grado_candidatura
      FROM users
      WHERE ruolo IN ('C', 'CP')
        AND (grado_candidatura = $1 OR grado_candidatura = $2)
        AND (status = 'A' OR status = 'a')
      ORDER BY nome, cognome
      LIMIT 4
    `;
    
    console.log('🔍 DEBUG - Query candidati:', candidatiQuery);
    console.log('🔍 DEBUG - Parametri:', [grado_candidatura, grado_candidatura.charAt(0).toUpperCase() + grado_candidatura.slice(1)]);
    
    const candidatiResult = await pool.query(candidatiQuery, [grado_candidatura, grado_candidatura.charAt(0).toUpperCase() + grado_candidatura.slice(1)]);
    const candidati = candidatiResult.rows;
    
    console.log('🔍 DEBUG - Candidati trovati:', candidati.length);
    candidati.forEach((candidato, index) => {
      console.log(`  ${index + 1}. ${candidato.nome} ${candidato.cognome} (${candidato.ruolo})`);
    });
    
    res.json({
      success: true,
      data: candidati,
      count: candidati.length,
      message: `Trovati ${candidati.length} candidati per grado_candidatura: ${grado_candidatura}`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i candidati'
    });
  }
});

// PUT /api/candidati/seleziona-candidato - Seleziona candidato per categoria
router.put('/seleziona-candidato', verifyToken, async (req, res) => {
  try {
    console.log('🎯 PUT /api/candidati/seleziona-candidato - Selezione candidato');
    
    const { campo, candidatoId } = req.body;
    const userId = req.userId; // ID dell'utente autenticato dal token
    
    console.log('🔍 DEBUG - userId:', userId);
    console.log('🔍 DEBUG - campo:', campo);
    console.log('🔍 DEBUG - candidatoId:', candidatoId);
    
    // Verifica che il campo sia valido per le selezioni di candidati
    const validFields = ['test_europeo', 'test_camera', 'test_senato', 'test_regionale', 'test_comune'];
    if (!validFields.includes(campo)) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido per le selezioni di candidati'
      });
    }
    
    // Mappa i campi test ai campi reali del database
    const fieldMapping = {
      'test_europeo': 'candidato_europeo',
      'test_camera': 'candidato_camera', 
      'test_senato': 'candidato_senato',
      'test_regionale': 'candidato_regionale',
      'test_comune': 'candidato_comune'
    };
    
    const realField = fieldMapping[campo];
    if (!realField) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido per le selezioni di candidati'
      });
    }
    
    // Aggiorna il campo del candidato
    const query = `UPDATE users SET ${realField} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [candidatoId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ Candidato selezionato con successo');
    
    res.json({
      success: true,
      message: 'Candidato selezionato con successo',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore durante la selezione candidato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/candidati/selezioni - Ottieni selezioni di candidati dell'utente
router.get('/selezioni', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/candidati/selezioni - Richiesta selezioni candidati');
    const userId = req.userId;
    console.log('🔍 DEBUG - userId:', userId);
    
    // Ottieni le selezioni di candidati dell'utente
    const userQuery = `
      SELECT 
        candidato_europeo,
        candidato_camera,
        candidato_senato,
        candidato_regionale,
        candidato_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0] || {};
    
    console.log('🔍 DEBUG Frontend - Utente selezioni candidati:', user);
    
    // Ottieni i dettagli dei candidati selezionati
    const candidatiSelezionati = {};
    const idMap = {};
    
    // Lista dei campi candidati
    const campiCandidati = [
      { campo: 'candidato_europeo', categoria: 'europeo' },
      { campo: 'candidato_camera', categoria: 'camera' },
      { campo: 'candidato_senato', categoria: 'senato' },
      { campo: 'candidato_regionale', categoria: 'regione' },
      { campo: 'candidato_comune', categoria: 'comune' }
    ];
    
    for (const { campo, categoria } of campiCandidati) {
      const candidatoId = user[campo];
      
      if (candidatoId) {
        // Cerca il candidato selezionato (rimuoviamo i filtri per trovare tutti gli utenti)
        const candidatoQuery = `
          SELECT 
            id,
            nome,
            cognome,
            email,
            ruolo,
            status,
            avatar_config
          FROM users
          WHERE id::text = $1
        `;
        
        console.log(`🔍 DEBUG - Cercando candidato con ID: ${candidatoId} per categoria: ${categoria}`);
        const candidatoResult = await pool.query(candidatoQuery, [candidatoId]);
        console.log(`🔍 DEBUG - Risultato query candidato:`, candidatoResult.rows.length, 'righe trovate');
        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          candidatiSelezionati[categoria] = [candidato];
          idMap[categoria] = candidatoId;
          console.log(`🔍 DEBUG Frontend - Candidato selezionato per ${categoria}:`, candidato.nome, candidato.cognome);
        } else {
          console.log(`❌ DEBUG - Nessun candidato trovato per ID: ${candidatoId} e categoria: ${categoria}`);
        }
      }
    }
    
    console.log('🔍 DEBUG Frontend - Candidati selezionati finali:', candidatiSelezionati);
    console.log('🔍 DEBUG Frontend - ID Map finale:', idMap);
    
    res.json({
      success: true,
      data: {
        candidati: candidatiSelezionati,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare selezioni candidati utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare selezioni candidati utente'
    });
  }
});

module.exports = router;
