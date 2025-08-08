// File: api/users.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');
const admin = require('firebase-admin'); // Per le operazioni su Firebase Auth

// ====================================================================
// INIZIO BLOCCO AGGIUNTO E RIORDINATO
// Le rotte più specifiche come /register e /me devono stare PRIMA
// delle rotte più generiche come /:uid
// ====================================================================

// POST /api/users/register - Crea un nuovo utente in Firebase Auth e nel DB
router.post('/register', async (req, res) => {
    // Estrai tutti i dati inviati dal form di registrazione
    const { email, password, nome, cognome, data_nascita, genere, cittadinanza, ruolo, ...altriDati } = req.body;

    if (!email || !password || !nome || !cognome || !ruolo) {
        return res.status(400).json({ error: "Dati essenziali mancanti per la registrazione." });
    }

    let newUserUid = null;

    try {
        // 1. Crea l'utente su Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: `${nome} ${cognome}`,
            disabled: true, // L'utente è disabilitato finché un admin non lo approva
        });
        
        newUserUid = userRecord.uid;

        // 2. Prepara tutti i campi per l'inserimento nel database PostgreSQL
        const allUserData = {
            id: newUserUid,
            email,
            nome,
            cognome,
            data_nascita,
            genere,
            cittadinanza,
            ruolo,
            status: 'pending', // Lo stato iniziale è sempre 'pending'
            data_registrazione: new Date(),
            ...altriDati
        };
        
        const columns = Object.keys(allUserData).map(key => `"${key}"`).join(', ');
        const values = Object.values(allUserData);
        const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const insertQuery = `INSERT INTO utenti (${columns}) VALUES (${valuePlaceholders}) RETURNING *;`;
        
        // 3. Salva i dati nel DB
        const dbResult = await pool.query(insertQuery, values);

        res.status(201).json(dbResult.rows[0]);

    } catch (error) {
        console.error("Errore durante la registrazione:", error);
        if (newUserUid) {
            await admin.auth().deleteUser(newUserUid);
            console.log(`Utente orfano ${newUserUid} cancellato da Firebase Auth.`);
        }
        res.status(500).json({ error: error.message || "Errore del server durante la registrazione." });
    }
});

// GET /api/users/me - Recupera i dati dell'utente attualmente loggato (usato da useAuth)
router.get('/me', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    try {
        const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Utente non trovato nel database." });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Errore GET /api/users/me:", error);
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
        
        // Abilita l'utente anche su Firebase Auth
        await admin.auth().updateUser(userId, { disabled: false });

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
        // Potresti voler cancellare l'utente da Firebase Auth se viene rifiutato
        // await admin.auth().deleteUser(userId);
        res.status(200).json({ success: true, message: 'Utente rifiutato' });
    } catch (error) {
        console.error("Errore POST /api/reject-user:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

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
    if (req.user.uid !== uid) {
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
    if (req.user.uid !== uid) return res.status(403).json({ error: "Accesso negato." });
    const campiPermessi = ['rappresentante_europeo', 'rappresentante_camera', 'rappresentante_senato', 'rappresentante_regionale', 'rappresentante_comunale'];
    if (!campiPermessi.includes(campo)) {
        return res.status(400).json({ error: "Campo non valido." });
    }
    try {
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
    const { uid } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM utenti WHERE id = $1', [uid]);
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

// ====================================================================
// QUESTO BLOCCO È STATO SPOSTATO ALLA FINE
// Deve stare dopo tutte le altre rotte più specifiche
// ====================================================================

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

module.exports = router;