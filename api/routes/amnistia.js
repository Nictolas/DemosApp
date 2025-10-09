const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// GET /api/amnistia - Ottieni leggi per amnistia
router.get('/', async (req, res) => {
  try {
    // 1. Ottieni tutti i voti per amnistia (senza timestamp)
    const votiQuery = `
      SELECT id, userid, firestore_userid, legge FROM voti_amnistia 
      ORDER BY id DESC
    `;
    const votiResult = await pool.query(votiQuery);
    
    // 2. Genera classifica basata sui voti
    const classificaQuery = `
      SELECT legge, COUNT(*) as voti
      FROM voti_amnistia 
      GROUP BY legge 
      ORDER BY voti DESC
    `;
    const classificaResult = await pool.query(classificaQuery);
    
    // 3. Se l'utente è autenticato, ottieni i suoi voti
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        const userVotiQuery = `
          SELECT legge FROM voti_amnistia 
          WHERE userid = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.legge);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per amnistia, continuando senza autenticazione');
      }
    }
    
    res.json({
      success: true,
      classifica: classificaResult.rows,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare leggi amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare leggi amnistia'
    });
  }
});

// POST /api/amnistia/vota - Vota per amnistia
router.post('/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    await pool.query(
      'INSERT INTO voti_amnistia (userid, legge) VALUES ($1, $2) ON CONFLICT (userid, legge) DO NOTHING',
      [userId, legge]
    );
    
    res.json({ success: true, message: 'Voto amnistia salvato' });
  } catch (error) {
    console.error('❌ Errore nel salvare voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voto amnistia'
    });
  }
});

// DELETE /api/amnistia/vota - Rimuovi voto per amnistia
router.delete('/vota', verifyToken, validateInput(['legge']), async (req, res) => {
  try {
    const { legge } = req.body;
    const userId = req.userId;
    
    const result = await pool.query(
      'DELETE FROM voti_amnistia WHERE userid = $1 AND legge = $2',
      [userId, legge]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato'
      });
    }
    
    res.json({ success: true, message: 'Voto amnistia rimosso' });
  } catch (error) {
    console.error('❌ Errore nel rimuovere voto amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel rimuovere voto amnistia'
    });
  }
});

// POST /api/amnistia - Crea nuova amnistia
router.post('/', verifyToken, validateInput(['legge', 'articolo', 'descrizione']), async (req, res) => {
  try {
    const { legge, articolo, descrizione } = req.body;
    
    // Prima crea la tabella se non esiste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS amnistia (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legge VARCHAR(255) NOT NULL,
        articolo VARCHAR(255) NOT NULL,
        descrizione TEXT NOT NULL,
        data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Inserisci la nuova amnistia
    const result = await pool.query(
      'INSERT INTO amnistia (legge, articolo, descrizione) VALUES ($1, $2, $3) RETURNING *',
      [legge, articolo, descrizione]
    );
    
    console.log('✅ Nuova amnistia creata:', result.rows[0]);
    
    res.json({
      success: true,
      message: 'Amnistia creata con successo',
      amnistia: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel creare amnistia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel creare amnistia'
    });
  }
});

module.exports = router;
