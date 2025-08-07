// File: api/users.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');
const admin = require('firebase-admin'); // Per le operazioni su Firebase Auth

// GET /api/users - Recupera tutti gli utenti ATTIVI (per GestisciUtenti)
router.get('/', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM utenti WHERE status = 'active' ORDER BY nome, cognome");
        res.json(result.rows);
    } catch (error) {
        console.error("Errore GET /api/users:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// GET /api/pending-users - Recupera gli utenti in attesa di approvazione
router.get('/pending-users', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM utenti WHERE status = 'pending' ORDER BY data_registrazione");
        res.json(result.rows);
    } catch (error) {
        console.error("Errore GET /api/pending-users:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/approve-user - Approva un utente
router.post('/approve-user', authenticateUser, async (req, res) => {
    const { userId } = req.body;
    try {
        // Aggiorna lo stato nel database
        await pool.query("UPDATE utenti SET status = 'active' WHERE id = $1", [userId]);
        
        // (Opzionale ma consigliato) Potresti voler abilitare l'utente anche su Firebase Auth
        // const userRecord = await admin.auth().getUser(userId); // Assumendo che l'ID del DB sia l'UID di Firebase
        // await admin.auth().updateUser(userRecord.uid, { disabled: false });

        res.status(200).json({ success: true, message: 'Utente approvato' });
    } catch (error) {
        console.error("Errore POST /api/approve-user:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/reject-user - Rifiuta un utente
router.post('/reject-user', authenticateUser, async (req, res) => {
    const { userId } = req.body;
    try {
        // Invece di cancellare, marchiamo come 'rejected' per tenere traccia
        await pool.query("UPDATE utenti SET status = 'rejected' WHERE id = $1", [userId]);
        res.status(200).json({ success: true, message: 'Utente rifiutato' });
    } catch (error) {
        console.error("Errore POST /api/reject-user:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// GET /api/users/:uid - Recupera i dati di un utente specifico
router.get('/:uid', authenticateUser, async (req, res) => {
    const { uid } = req.params;
    try {
        const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [uid]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Utente non trovato." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore GET /api/users/${uid}:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// GET /api/users/:uid/public - Recupera solo i dati pubblici di un utente
router.get('/:uid/public', async (req, res) => {
    const { uid } = req.params;
    try {
        const result = await pool.query('SELECT nome, cognome, avatar_config FROM utenti WHERE id = $1', [uid]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Utente non trovato." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore GET /api/users/${uid}/public:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/users/:uid/avatar - Aggiorna l'avatar di un utente
router.post('/:uid/avatar', authenticateUser, async (req, res) => {
    const { uid } = req.params;
    const { avatar_config } = req.body;
    // Sicurezza: assicurati che l'utente stia modificando il proprio profilo o sia un admin
    if (req.user.uid !== uid /* && req.user.role !== 'Admin' */) {
        return res.status(403).json({ error: "Accesso negato." });
    }
    try {
        const result = await pool.query('UPDATE utenti SET avatar_config = $1 WHERE id = $2 RETURNING avatar_config', [avatar_config, uid]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/users/${uid}/avatar:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// PUT /api/users/:uid/seleziona-rappresentante - Aggiorna un rappresentante scelto dall'utente
router.put('/:uid/seleziona-rappresentante', authenticateUser, async (req, res) => {
    const { uid } = req.params;
    const { campo, rappresentanteId } = req.body;
    // Sicurezza
    if (req.user.uid !== uid) return res.status(403).json({ error: "Accesso negato." });
    // Whitelist dei campi permessi per evitare SQL injection
    const campiPermessi = ['rappresentante_europeo', 'rappresentante_camera', 'rappresentante_senato', 'rappresentante_regionale', 'rappresentante_comunale'];
    if (!campiPermessi.includes(campo)) {
        return res.status(400).json({ error: "Campo non valido." });
    }
    try {
        // Usiamo il placeholder per il nome della colonna in modo sicuro non è possibile direttamente,
        // ma siccome abbiamo validato il nome della colonna, possiamo inserirlo nella stringa.
        const query = `UPDATE utenti SET "${campo}" = $1 WHERE id = $2 RETURNING *`;
        const result = await pool.query(query, [rappresentanteId, uid]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore PUT /api/users/${uid}/seleziona-rappresentante:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// DELETE /api/users/:uid - Elimina un utente (sia dal DB che da Firebase Auth)
router.delete('/:uid', authenticateUser, async (req, res) => {
    // Solo un Admin può eliminare altri utenti
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    const { uid } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Elimina dal DB PostgreSQL
        await client.query('DELETE FROM utenti WHERE id = $1', [uid]);

        // 2. Elimina da Firebase Authentication
        await admin.auth().deleteUser(uid);

        await client.query('COMMIT');
        res.status(204).send();
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Errore DELETE /api/users/${uid}:`, error);
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ error: "Utente non trovato su Firebase Authentication." });
        }
        res.status(500).json({ error: "Errore del server durante l'eliminazione." });
    } finally {
        client.release();
    }
});

module.exports = router;