// File: api/statistiche.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/statistiche/utenti - Calcola e restituisce le statistiche aggregate sugli utenti
router.get('/utenti', authenticateUser, async (req, res) => {
    // Aggiungi un controllo per assicurarti che solo un Admin possa accedere
    // const userRoleResult = await pool.query('SELECT ruolo FROM utenti WHERE id = $1', [req.user.uid]);
    // if (userRoleResult.rows[0]?.ruolo !== 'Admin') {
    //     return res.status(403).json({ error: "Accesso negato." });
    // }

    try {
        // Eseguiamo più query in parallelo per efficienza
        const [
            totalUsersResult,
            usersByRoleResult,
            usersByGenderResult,
            usersByCitizenshipResult,
            usersByRegionResult,
            usersByCityResult
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM utenti'),
            pool.query('SELECT ruolo, COUNT(*) FROM utenti WHERE ruolo IS NOT NULL GROUP BY ruolo'),
            pool.query('SELECT genere, COUNT(*) FROM utenti WHERE genere IS NOT NULL GROUP BY genere'),
            pool.query('SELECT cittadinanza, COUNT(*) FROM utenti WHERE cittadinanza IS NOT NULL GROUP BY cittadinanza'),
            pool.query('SELECT regione_residenza, COUNT(*) FROM utenti WHERE regione_residenza IS NOT NULL GROUP BY regione_residenza'),
            pool.query('SELECT comune_residenza, COUNT(*) FROM utenti WHERE comune_residenza IS NOT NULL GROUP BY comune_residenza')
        ]);

        // Funzione helper per trasformare l'array di risultati in un oggetto
        const arrayToObject = (rows, keyField, valueField) => {
            return rows.reduce((acc, row) => {
                acc[row[keyField]] = parseInt(row[valueField], 10);
                return acc;
            }, {});
        };

        const stats = {
            totalUsers: parseInt(totalUsersResult.rows[0].count, 10),
            usersByRole: arrayToObject(usersByRoleResult.rows, 'ruolo', 'count'),
            usersByGender: arrayToObject(usersByGenderResult.rows, 'genere', 'count'),
            usersByCitizenship: arrayToObject(usersByCitizenshipResult.rows, 'cittadinanza', 'count'),
            usersByRegion: arrayToObject(usersByRegionResult.rows, 'regione_residenza', 'count'),
            usersByCity: arrayToObject(usersByCityResult.rows, 'comune_residenza', 'count')
        };

        res.json(stats);

    } catch (error) {
        console.error("Errore GET /api/statistiche/utenti:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

module.exports = router;