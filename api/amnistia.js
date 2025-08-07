// File: api/amnistia.js

const express = require('express');
const router = express.Router();
// IMPORTANTE: Devi creare questi due file o adattare i percorsi
const { pool } = require('../db'); // Assumiamo che la connessione al DB sia in /db.js
const { authenticateUser } = require('../middleware/auth'); // Assumiamo che il middleware sia in /middleware/auth.js

// GET /api/amnistia - Recupera classifica e voti utente
router.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid; 
  try {
    const classificaQuery = `
      SELECT legge, COUNT(*) as voti FROM voti_amnistia
      GROUP BY legge ORDER BY voti DESC LIMIT 10;
    `;
    const classificaResult = await pool.query(classificaQuery);
    
    const mieiVotiQuery = `SELECT legge FROM voti_amnistia WHERE user_id = $1;`;
    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    
    const classifica = classificaResult.rows;
    const mieiVoti = mieiVotiResult.rows.map(row => row.legge);

    res.json({ classifica, mieiVoti });
  } catch (error) {
    console.error("Errore GET /api/amnistia:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/amnistia/vota - Aggiunge un nuovo voto
router.post('/vota', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { legge } = req.body;

  if (!legge || typeof legge !== 'string' || legge.trim() === '') {
    return res.status(400).json({ error: "Il nome della legge è obbligatorio." });
  }
  try {
    const insertQuery = 'INSERT INTO voti_amnistia (user_id, legge) VALUES ($1, $2) ON CONFLICT (user_id, legge) DO NOTHING';
    await pool.query(insertQuery, [userId, legge.trim()]);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Errore POST /api/amnistia/vota:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// DELETE /api/amnistia/vota - Rimuove un voto
router.delete('/vota', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { legge } = req.body;

  if (!legge || typeof legge !== 'string' || legge.trim() === '') {
    return res.status(400).json({ error: "Il nome della legge è obbligatorio." });
  }
  try {
    const deleteQuery = 'DELETE FROM voti_amnistia WHERE user_id = $1 AND legge = $2';
    const result = await pool.query(deleteQuery, [userId, legge.trim()]);
    
    if (result.rowCount === 0) return res.status(404).json({ error: "Voto non trovato." });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Errore DELETE /api/amnistia/vota:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

module.exports = router;