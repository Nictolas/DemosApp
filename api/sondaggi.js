// File: api/sondaggi.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/sondaggi/stats - Calcola e restituisce le statistiche aggregate
router.get('/stats', authenticateUser, async (req, res) => {
    // Aggiungi un controllo per assicurarti che solo un Admin possa accedere
    // const userRoleResult = await pool.query('SELECT ruolo FROM utenti WHERE id = $1', [req.user.uid]);
    // if (userRoleResult.rows[0]?.ruolo !== 'Admin') {
    //     return res.status(403).json({ error: "Accesso negato." });
    // }

    const client = await pool.connect();
    try {
        // 1. Recupera la lista di tutte le domande/opinioni disponibili
        const questionsResult = await client.query('SELECT id, text FROM opinioni ORDER BY text ASC');
        const questions = questionsResult.rows;

        if (questions.length === 0) {
            return res.json({ stats: {}, questions: [] });
        }
        
        // 2. Costruisci dinamicamente la query SQL per contare i voti per ogni opinione
        const questionIds = questions.map(q => q.id);

        // Prepara una serie di sub-query per ogni domanda
        const selectClauses = questionIds.map(id => `
            COUNT(CASE WHEN "${id}" = 'Favorevole' THEN 1 END) AS "${id}_favorevole",
            COUNT(CASE WHEN "${id}" = 'Contrario' THEN 1 END) AS "${id}_contrario",
            COUNT(CASE WHEN "${id}" = 'Indeciso' THEN 1 END) AS "${id}_astenuto"
        `).join(', ');

        const statsQuery = `SELECT ${selectClauses} FROM utenti`;
        
        const statsResult = await client.query(statsQuery);
        const rawStats = statsResult.rows[0];

        // 3. Formatta i dati per il frontend
        const formattedStats = {};
        questionIds.forEach(id => {
            formattedStats[id] = {
                favorevole: parseInt(rawStats[`${id}_favorevole`], 10) || 0,
                contrario: parseInt(rawStats[`${id}_contrario`], 10) || 0,
                astenuto: parseInt(rawStats[`${id}_astenuto`], 10) || 0,
            };
        });

        res.json({ stats: formattedStats, questions });

    } catch (error) {
        console.error("Errore GET /api/sondaggi/stats:", error);
        res.status(500).json({ error: "Errore del server" });
    } finally {
        client.release();
    }
});

module.exports = router;