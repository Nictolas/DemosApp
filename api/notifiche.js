// File: api/notifiche.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/notifiche - Recupera i dati per la pagina notifiche
router.get('/', authenticateUser, async (req, res) => {
    const userId = req.user.uid;

    try {
        // 1. Recupera i dati dell'utente, inclusi i suoi rappresentanti e le preferenze
        const userResult = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: "Utente non trovato." });
        
        const userData = userResult.rows[0];
        const rappresentantiSeguiti = [
            userData.rappresentante_europeo,
            userData.rappresentante_camera,
            userData.rappresentante_senato,
            userData.rappresentante_regionale,
            userData.rappresentante_comunale,
        ].filter(Boolean); // Rimuove eventuali valori null o undefined

        if (rappresentantiSeguiti.length === 0) {
            return res.json({
                comunicazioni: [],
                rappresentantiInfo: {},
                preferenze: userData.notifiche_preferenze || {}
            });
        }

        // 2. Recupera le comunicazioni recenti dei rappresentanti seguiti
        const comunicazioniQuery = `
            SELECT c.*, vc.reaction as voto_utente
            FROM comunicazioni c
            LEFT JOIN voti_comunicazioni vc ON c.id = vc.comunicazione_id AND vc.user_id = $1
            WHERE c.id_utente = ANY($2::text[]) 
            AND c.data_creazione >= NOW() - INTERVAL '3 days'
            ORDER BY c.data_creazione DESC;
        `;
        const comunicazioniResult = await pool.query(comunicazioniQuery, [userId, rappresentantiSeguiti]);

        // 3. Recupera i dati (nome, avatar) dei rappresentanti seguiti
        const rappresentantiInfoQuery = `
            SELECT id, nome, cognome, avatar_config, grado_elezione 
            FROM utenti 
            WHERE id = ANY($1::text[]);
        `;
        const rappresentantiInfoResult = await pool.query(rappresentantiInfoQuery, [rappresentantiSeguiti]);
        
        // Formatta i dati dei rappresentanti in un oggetto per un facile accesso
        const rappresentantiInfoMap = rappresentantiInfoResult.rows.reduce((acc, curr) => {
            acc[curr.id] = curr;
            return acc;
        }, {});
        
        res.json({
            comunicazioni: comunicazioniResult.rows,
            rappresentantiInfo: rappresentantiInfoMap,
            preferenze: userData.notifiche_preferenze || {}
        });

    } catch (error) {
        console.error("Errore GET /api/notifiche:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/notifiche/preferenze - Salva le preferenze di notifica dell'utente
router.post('/preferenze', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { preferenze } = req.body;

    if (typeof preferenze !== 'object' || preferenze === null) {
        return res.status(400).json({ error: "Formato preferenze non valido." });
    }
    
    try {
        const query = 'UPDATE utenti SET notifiche_preferenze = $1 WHERE id = $2 RETURNING notifiche_preferenze';
        const result = await pool.query(query, [preferenze, userId]);
        res.status(200).json(result.rows[0].notifiche_preferenze);
    } catch (error) {
        console.error("Errore POST /api/notifiche/preferenze:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


module.exports = router;