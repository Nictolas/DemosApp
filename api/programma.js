// File: api/programma.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/programma - Recupera il programma dell'utente loggato
router.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Recupera sia i dati utente che il programma in una sola richiesta per efficienza
    const userQuery = 'SELECT id, ruolo FROM utenti WHERE id = $1';
    const programmaQuery = 'SELECT * FROM programmi WHERE user_id = $1';

    const [userResult, programmaResult] = await Promise.all([
        pool.query(userQuery, [userId]),
        pool.query(programmaQuery, [userId])
    ]);
    
    const user = userResult.rows[0];
    const programma = programmaResult.rows[0] || {}; // Restituisce un oggetto vuoto se non c'è programma

    // Rimuove user_id dal programma per non essere ridondante
    delete programma.user_id;

    res.json({ user, programma });

  } catch (error) {
    console.error("Errore GET /api/programma:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/programma - Crea o aggiorna il programma dell'utente loggato
router.post('/', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { proposta1, proposta2, proposta3, proposta4, proposta5 } = req.body;
  
    // Controllo di autorizzazione: solo certi ruoli possono scrivere un programma
    const userRoleResult = await pool.query('SELECT ruolo FROM utenti WHERE id = $1', [userId]);
    const userRole = userRoleResult.rows[0]?.ruolo;
    if (!["Admin", "Candidato", "Candidato Politico"].includes(userRole)) {
        return res.status(403).json({ error: "Accesso negato: ruolo non autorizzato." });
    }

    try {
        const query = `
            INSERT INTO programmi (user_id, proposta1, proposta2, proposta3, proposta4, proposta5)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE SET
                proposta1 = EXCLUDED.proposta1,
                proposta2 = EXCLUDED.proposta2,
                proposta3 = EXCLUDED.proposta3,
                proposta4 = EXCLUDED.proposta4,
                proposta5 = EXCLUDED.proposta5
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, proposta1, proposta2, proposta3, proposta4, proposta5]);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Errore POST /api/programma:", error);
        res.status(500).json({ error: "Errore del server durante il salvataggio del programma." });
    }
});

module.exports = router;