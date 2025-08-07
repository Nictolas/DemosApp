// File: api/capo-stato.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/capo-stato - Recupera classifica, voti utente e stato del blocco
router.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Query per la classifica generale
    const classificaQuery = `
      SELECT nome, COUNT(*) as voti
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti DESC
      LIMIT 10;
    `;
    const classificaResult = await pool.query(classificaQuery);

    // Query per i voti specifici dell'utente
    const mieiVotiQuery = `SELECT nome FROM voti_capo_stato WHERE user_id = $1;`;
    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    
    // Query per controllare lo stato del blocco settimanale
    const bloccoQuery = `SELECT "lastCapoStatoEdit" FROM utenti WHERE id = $1;`;
    const userResult = await pool.query(bloccoQuery, [userId]);
    const lastEdit = userResult.rows[0]?.lastCapoStatoEdit;
    
    let isBlocked = false;
    let unlockDate = null;
    if (lastEdit) {
        const now = new Date();
        const lastEditDate = new Date(lastEdit);
        const diff = now.getTime() - lastEditDate.getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (diff < weekMs) {
            isBlocked = true;
            unlockDate = new Date(lastEditDate.getTime() + weekMs);
        }
    }

    // Formattazione dei risultati per il frontend
    const classifica = classificaResult.rows;
    const mieiVoti = mieiVotiResult.rows.map(row => row.nome);

    res.json({ 
        classifica, 
        mieiVoti, 
        blocco: { isBlocked, unlockDate } 
    });

  } catch (error) {
    console.error("Errore GET /api/capo-stato:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/capo-stato/vota - Salva/Aggiorna i voti dell'utente
router.post('/vota', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { voti } = req.body; // Array di nomi votati

    if (!Array.isArray(voti)) {
        return res.status(400).json({ error: "Il formato dei voti non è valido." });
    }

    // Inizia una transazione per assicurare che tutte le operazioni vengano eseguite o nessuna
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controlla il blocco settimanale prima di procedere
        const userResult = await client.query('SELECT "lastCapoStatoEdit" FROM utenti WHERE id = $1;', [userId]);
        const lastEdit = userResult.rows[0]?.lastCapoStatoEdit;
        if (lastEdit) {
            const now = new Date();
            const diff = now.getTime() - new Date(lastEdit).getTime();
            if (diff < (7 * 24 * 60 * 60 * 1000)) {
                throw new Error("Puoi modificare i voti solo una volta a settimana.");
            }
        }
        
        // 1. Cancella tutti i voti precedenti dell'utente per questa categoria
        await client.query('DELETE FROM voti_capo_stato WHERE user_id = $1', [userId]);

        // 2. Inserisce i nuovi voti
        if (voti.length > 0) {
            const insertQuery = 'INSERT INTO voti_capo_stato (user_id, nome) VALUES ' + 
                                voti.map((_, i) => `($1, $${i + 2})`).join(',');
            await client.query(insertQuery, [userId, ...voti]);
        }

        // 3. Aggiorna il timestamp dell'ultima modifica
        await client.query('UPDATE utenti SET "lastCapoStatoEdit" = NOW() WHERE id = $1', [userId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Voti salvati con successo." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/capo-stato/vota:", error);
        res.status(500).json({ error: error.message || "Errore del server" });
    } finally {
        client.release();
    }
});

module.exports = router;