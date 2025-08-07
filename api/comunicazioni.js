// File: api/comunicazioni.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/comunicazioni/check-duplicate?titolo=... - Controlla se una comunicazione esiste già
router.get('/check-duplicate', authenticateUser, async (req, res) => {
    const { titolo } = req.query;
    const userId = req.user.uid;

    if (!titolo) {
        return res.status(400).json({ error: "Il titolo è obbligatorio." });
    }

    try {
        // Determina la "zona" dell'utente che sta postando
        const userResult = await pool.query('SELECT grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione FROM utenti WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: "Utente non trovato" });

        const userData = userResult.rows[0];
        let zona = "Zona non specificata";
        if (userData.grado_elezione === "Comunale") zona = `Comune di ${userData.comune_elezione}`;
        else if (userData.grado_elezione === "Regionale") zona = `Regione ${userData.regione_elezione}`;
        // Aggiungi altre logiche per provincia, stato, etc.

        const query = 'SELECT titolo, vincitore, zona FROM comunicazioni WHERE titolo = $1 AND zona = $2 LIMIT 1';
        const result = await pool.query(query, [titolo, zona]);

        if (result.rows.length > 0) {
            res.json({ exists: true, comunicazione: result.rows[0] });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error("Errore GET /api/comunicazioni/check-duplicate:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/comunicazioni - Crea una nuova comunicazione
router.post('/', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { titolo, voto_dato, commento, vincitore } = req.body;

    if (!titolo || !voto_dato || !vincitore) {
        return res.status(400).json({ error: "Titolo, voto e vincitore sono obbligatori." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Recupera i dati dell'utente per arricchire la comunicazione
        const userResult = await client.query('SELECT nome, cognome, ruolo, grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione FROM utenti WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) throw new Error("Utente non trovato");
        
        const userData = userResult.rows[0];
        // Determina la zona
        let zona = "Zona non specificata";
        if (userData.grado_elezione === "Comunale") zona = `Comune di ${userData.comune_elezione}`;
        // ... (aggiungi altre logiche come sopra)

        // Inserisci la nuova comunicazione
        const insertQuery = `
            INSERT INTO comunicazioni (id_utente, titolo, voto_dato, commento, vincitore, zona)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [userId, titolo, voto_dato, commento || null, vincitore, zona]);
        
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/comunicazioni:", error);
        res.status(500).json({ error: "Errore del server" });
    } finally {
        client.release();
    }
});


// POST /api/comunicazioni/:id/react - Aggiunge un like/dislike a una comunicazione
router.post('/:id/react', authenticateUser, async (req, res) => {
    const { id: comunicazioneId } = req.params;
    const userId = req.user.uid;
    const { reaction } = req.body; // 'like' o 'dislike'

    if (!['like', 'dislike'].includes(reaction)) {
        return res.status(400).json({ error: "Reazione non valida." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controlla se l'utente ha già votato
        const existingVote = await client.query('SELECT * FROM voti_comunicazioni WHERE comunicazione_id = $1 AND user_id = $2', [comunicazioneId, userId]);
        if (existingVote.rows.length > 0) {
            return res.status(409).json({ error: "Hai già espresso una preferenza per questa comunicazione." });
        }

        // Inserisce il voto nella tabella di tracciamento
        await client.query('INSERT INTO voti_comunicazioni (comunicazione_id, user_id, reaction) VALUES ($1, $2, $3)', [comunicazioneId, userId, reaction]);

        // Aggiorna il contatore nella tabella principale
        const columnToUpdate = reaction === 'like' ? 'likes' : 'dislikes';
        await client.query(`UPDATE comunicazioni SET ${columnToUpdate} = ${columnToUpdate} + 1 WHERE id = $1`, [comunicazioneId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Reazione registrata." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Errore POST /api/comunicazioni/${comunicazioneId}/react:`, error);
        res.status(500).json({ error: "Errore del server" });
    } finally {
        client.release();
    }
});

// GET /api/comunicazioni/ultima - Recupera l'ultima comunicazione dell'utente loggato (per la pagina Riscontro)
router.get('/ultima', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    try {
        const query = 'SELECT * FROM comunicazioni WHERE id_utente = $1 ORDER BY data_creazione DESC LIMIT 1';
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nessuna comunicazione trovata." });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Errore GET /api/comunicazioni/ultima:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


module.exports = router;