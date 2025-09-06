const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/elezioni/prossime - Ottieni le prossime elezioni
router.get('/prossime', async (req, res) => {
  try {
    const query = `
      SELECT * FROM elezioni 
      WHERE createdat > NOW() 
      ORDER BY createdat ASC 
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni'
    });
  }
});

// GET /api/elezioni - Ottieni tutte le elezioni (per gestione)
router.get('/', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM elezioni 
      ORDER BY createdat DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni'
    });
  }
});

// GET /api/elezioni-utente - Ottieni elezioni per utente (endpoint principale)
router.get('/utente', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT e.*, 
             CASE WHEN v.user_id IS NOT NULL THEN true ELSE false END as ha_votato
      FROM elezioni e
      LEFT JOIN voti_elezioni v ON e.id = v.elezione_id AND v.user_id = $1
      WHERE e.createdat > NOW()
      ORDER BY e.createdat ASC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni utente'
    });
  }
});

// GET /api/elezioni-utente - Endpoint per la pagina Elezioni (simile a rappresentanti)
router.get('/elezioni-utente', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/elezioni-utente - Richiesta candidati');
    const userId = req.userId;
    console.log('🔍 DEBUG - userId:', userId);
    
    // Ottieni i candidati selezionati dall'utente
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
    
    console.log('🔍 DEBUG - Candidati selezionati dall\'utente:', user);
    
    // Ottieni i dettagli dei candidati selezionati
    const candidatiIds = [
      user.candidato_europeo,
      user.candidato_camera,
      user.candidato_senato,
      user.candidato_regionale,
      user.candidato_comune
    ].filter(id => id); // Rimuovi valori null/undefined
    
    let candidatiDettagliati = {};
    
    if (candidatiIds.length > 0) {
      const candidatiQuery = `
        SELECT 
          id,
          nome,
          cognome,
          email,
          ruolo,
          status,
          avatar_config,
          grado_candidatura,
          regione_candidatura,
          provincia_candidatura,
          comune_candidatura
        FROM users
        WHERE id = ANY($1)
      `;
      
      const candidatiResult = await pool.query(candidatiQuery, [candidatiIds]);
      
      // Crea un oggetto con id come chiave
      candidatiDettagliati = candidatiResult.rows.reduce((acc, candidato) => {
        acc[candidato.id] = {
          nome: candidato.nome,
          cognome: candidato.cognome,
          avatar_config: candidato.avatar_config
        };
        return acc;
      }, {});
    }
    
    console.log('🔍 DEBUG - Candidati dettagliati:', candidatiDettagliati);
    
    // Organizza i candidati per categoria (come fa rappresentanti)
    const candidatiPerCategoria = {
      europeo: user.candidato_europeo ? [candidatiDettagliati[user.candidato_europeo]] : [],
      camera: user.candidato_camera ? [candidatiDettagliati[user.candidato_camera]] : [],
      senato: user.candidato_senato ? [candidatiDettagliati[user.candidato_senato]] : [],
      regione: user.candidato_regionale ? [candidatiDettagliati[user.candidato_regionale]] : [],
      comune: user.candidato_comune ? [candidatiDettagliati[user.candidato_comune]] : []
    };
    
    // Crea idMap per compatibilità con il frontend
    const idMap = {
      europeo: user.candidato_europeo || null,
      camera: user.candidato_camera || null,
      senato: user.candidato_senato || null,
      regione: user.candidato_regionale || null,
      comune: user.candidato_comune || null
    };
    
    res.json({
      success: true,
      data: {
        candidati: candidatiPerCategoria,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati per elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare candidati per elezioni'
    });
  }
});

// POST /api/elezioni - Crea nuova elezione
router.post('/', verifyToken, validateInput(['titolo', 'descrizione', 'tipo', 'candidati']), async (req, res) => {
  try {
    const { titolo, descrizione, tipo, candidati } = req.body;
    
    const query = `
      INSERT INTO elezioni (titolo, descrizione, tipo, candidati, createdat)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, tipo, JSON.stringify(candidati)]);
    
    res.json({
      success: true,
      elezione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione elezione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione elezione'
    });
  }
});

// GET /api/candidati - Ottieni candidati per grado e categoria
router.get('/candidati', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    
    const query = `
      SELECT c.*, u.nome, u.cognome
      FROM candidati c
      JOIN users u ON c.user_id = u.id
      WHERE c.grado = $1 AND c.categoria = $2
      ORDER BY u.nome, u.cognome
    `;
    
    const result = await pool.query(query, [grado, categoria]);
    
    res.json({
      success: true,
      candidati: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare candidati'
    });
  }
});

module.exports = router;
