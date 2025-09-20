const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/test/disponibili - Ottieni candidati disponibili per grado_candidatura
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado_candidatura } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/test/disponibili - Richiesta ricevuta:', { grado_candidatura, userId });
    
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
      WHERE ruolo IN ('Candidato', 'Candidato Politico')
        AND (grado_candidatura = $1 OR grado_candidatura = $2)
        AND (status = 'attivo' OR status = 'active')
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
    console.error('❌ Errore nel recuperare candidati test:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i candidati'
    });
  }
});

// PUT /api/test/seleziona-candidato - Seleziona candidato per categoria di test
router.put('/seleziona-candidato', verifyToken, async (req, res) => {
  try {
    console.log('🎯 PUT /api/test/seleziona-candidato - Selezione candidato test');
    
    const { campo, candidatoId } = req.body;
    const userId = req.userId; // ID dell'utente autenticato dal token
    
    console.log('🔍 DEBUG - userId:', userId);
    console.log('🔍 DEBUG - campo:', campo);
    console.log('🔍 DEBUG - candidatoId:', candidatoId);
    
    // Verifica che il campo sia valido per le selezioni di test
    const validFields = ['test_europeo', 'test_camera', 'test_senato', 'test_regionale', 'test_comune'];
    if (!validFields.includes(campo)) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido per le selezioni di test'
      });
    }
    
    // Aggiorna il campo del candidato di test
    const query = `UPDATE users SET ${campo} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [candidatoId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ Candidato di test selezionato con successo');
    
    res.json({
      success: true,
      message: 'Candidato di test selezionato con successo',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore durante la selezione candidato test:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/test/selezioni - Ottieni selezioni di test dell'utente
router.get('/selezioni', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/test/selezioni - Richiesta selezioni test');
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
    
    console.log('🔍 DEBUG Frontend - Utente selezioni test:', user);
    
    // Ottieni i dettagli dei candidati selezionati per test
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
        // Cerca il candidato selezionato tra tutti i candidati disponibili per quella categoria
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
          AND ruolo IN ('Candidato', 'Candidato Politico')
          AND grado_candidatura = $2
        `;
        
        console.log(`🔍 DEBUG - Cercando candidato test con ID: ${candidatoId} per categoria: ${categoria}`);
        const candidatoResult = await pool.query(candidatoQuery, [candidatoId, categoria]);
        console.log(`🔍 DEBUG - Risultato query candidato test:`, candidatoResult.rows.length, 'righe trovate');
        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          candidatiSelezionati[categoria] = [candidato];
          idMap[categoria] = candidatoId;
          console.log(`🔍 DEBUG Frontend - Candidato test selezionato per ${categoria}:`, candidato.nome, candidato.cognome);
        } else {
          console.log(`❌ DEBUG - Nessun candidato test trovato per ID: ${candidatoId} e categoria: ${categoria}`);
        }
      }
    }
    
    console.log('🔍 DEBUG Frontend - Candidati test selezionati finali:', candidatiSelezionati);
    console.log('🔍 DEBUG Frontend - ID Map test finale:', idMap);
    
    res.json({
      success: true,
      data: {
        candidati: candidatiSelezionati,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare selezioni test utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare selezioni test utente'
    });
  }
});

module.exports = router;
