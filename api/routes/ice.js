const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// GET /api/ice - Ottieni richieste ICE
router.get('/', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/ice');
    // Disabilita caching per evitare dati stantii lato client/proxy
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Ottieni il ruolo dell'utente se autenticato
    let userRole = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        // Ottieni il ruolo dell'utente
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        if (userResult.rows.length > 0) {
          userRole = userResult.rows[0].ruolo;
          console.log(`🔍 Ruolo utente: ${userRole}`);
        }
      } catch (authError) {
        console.log('⚠️ Errore nel recupero ruolo utente:', authError.message);
      }
    }
    
    // Query con filtro basato sul ruolo
    let query;
    if (userRole === 'Admin' || userRole === 'Moderatore') {
      // Admin e Moderatori vedono tutte le ICE
      query = `
        SELECT *
        FROM ice
        ORDER BY datainizio DESC NULLS LAST, data_creazione DESC
      `;
    } else {
      // Altri utenti vedono solo le ICE ufficiali (quorum != 'proposta')
      query = `
        SELECT *
        FROM ice
        WHERE quorum != 'proposta'
        ORDER BY datainizio DESC NULLS LAST, data_creazione DESC
      `;
    }
    
    const result = await pool.query(query);
    console.log(`✅ Recuperati ${result.rows.length} record da ice`);
    
    // Se l'utente è autenticato, ottieni i suoi voti
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        const userVotiQuery = `
          SELECT ice_id FROM voti_ice 
          WHERE utente_id = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.ice_id);
        console.log(`✅ Recuperati ${mieiVoti.length} voti utente`);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per ICE, continuando senza autenticazione');
      }
    }
    
    res.json({
      success: true,
      richieste: result.rows,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste ICE',
      details: error.message
    });
  }
});

// GET /api/ice/richieste - Ottieni richieste per gestione
router.get('/richieste', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM ice
      ORDER BY data_creazione DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste ICE'
    });
  }
});

// POST /api/ice - Crea richiesta ICE
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    // Validazione campi obbligatori
    if (!nome || !descrizione) {
      return res.status(400).json({
        success: false,
        error: 'Nome e descrizione sono obbligatori'
      });
    }
    
    // Genera un ID univoco per la richiesta ICE
    const iceId = `ice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Usa la colonna quorum per distinguere le ICE proposte
    const query = `
      INSERT INTO ice (id, nome, descrizione, data_inizio, data_fine, sito_web, quorum, data_creazione)
      VALUES ($1, $2, $3, $4, $5, $6, 'proposta', NOW())
      RETURNING *
    `;
    
    const params = [iceId, nome, descrizione, dataInizio, dataFine, sitoWeb];
    
    const result = await pool.query(query, params);
    
    console.log(`✅ ICE proposta creata: ${iceId}`);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione richiesta ICE'
    });
  }
});

// POST /api/ice/:id/:action - Gestisci richiesta ICE
router.post('/:id/:action', verifyToken, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action === 'approve') {
      await pool.query('UPDATE ice SET quorum = $1 WHERE id = $2', ['ok', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE ice SET quorum = $1 WHERE id = $2', ['no', id]);
    }
    
    res.json({ success: true, message: `Richiesta ICE ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione richiesta ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione richiesta ICE'
    });
  }
});

// POST /api/ice/vota - Vota per una richiesta ICE
router.post('/vota', verifyToken, validateInput(['ice_id', 'voto']), async (req, res) => {
  try {
    const { ice_id, voto } = req.body;
    const userId = req.userId;
    
    // Verifica se l'utente ha già votato per questa ICE
    const existingVoteQuery = 'SELECT id FROM voti_ice WHERE utente_id = $1 AND ice_id = $2';
    const existingVoteResult = await pool.query(existingVoteQuery, [userId, ice_id]);
    
    if (existingVoteResult.rows.length > 0) {
      // Aggiorna il voto esistente
      await pool.query(
        'UPDATE voti_ice SET voto = $1, data_voto = NOW() WHERE utente_id = $2 AND ice_id = $3',
        [voto, userId, ice_id]
      );
    } else {
      // Inserisci un nuovo voto
      await pool.query(
        'INSERT INTO voti_ice (utente_id, ice_id, voto, data_voto) VALUES ($1, $2, $3, NOW())',
        [userId, ice_id, voto]
      );
    }
    
    res.json({ success: true, message: 'Voto ICE salvato' });
  } catch (error) {
    console.error('❌ Errore nel salvare voto ICE:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voto ICE'
    });
  }
});

module.exports = router;
