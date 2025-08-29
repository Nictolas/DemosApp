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
      WHERE data > NOW() 
      ORDER BY data ASC 
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
      ORDER BY data DESC
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

// GET /api/elezioni-utente - Ottieni elezioni per utente
router.get('/utente', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT e.*, 
             CASE WHEN v.user_id IS NOT NULL THEN true ELSE false END as ha_votato
      FROM elezioni e
      LEFT JOIN voti_elezioni v ON e.id = v.elezione_id AND v.user_id = $1
      WHERE e.data > NOW()
      ORDER BY e.data ASC
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

// POST /api/elezioni - Crea nuova elezione
router.post('/', verifyToken, validateInput(['titolo', 'descrizione', 'data', 'tipo', 'candidati']), async (req, res) => {
  try {
    const { titolo, descrizione, data, tipo, candidati } = req.body;
    
    const query = `
      INSERT INTO elezioni (titolo, descrizione, data, tipo, candidati, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, data, tipo, JSON.stringify(candidati)]);
    
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
