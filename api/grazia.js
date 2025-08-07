// File: api/grazia.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/grazia - Recupera classifica, voti utente e stato del blocco
router.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Query per la classifica generale
    const classificaQuery = `
      SELECT nome, COUNT(*) as voti
      FROM voti_grazia
      GROUP BY nome
      ORDER BY voti DESC
      LIMIT 10;
    `;
    const classificaResult = await pool.query(classificaQuery);

    // Query per i voti specifici dell'utente
    const mieiVotiQuery = `SELECT nome FROM voti_grazia WHERE user_id = $1;`;
    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    
    // Query per controllare lo stato del blocco settimanale
    const bloccoQuery = `SELECT "lastGraziaEdit" FROM utenti WHERE id = $1;`;
    const userResult = await pool.query(bloccoQuery, [userId]);
    const lastEdit = userResult.rows[0]?.lastGraziaEdit;
    
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

    // Formattazione dei risultati
    const classifica = classificaResult.rows;
    const mieiVoti = mieiVotiResult.rows.map(row => row.nome);

    res.json({ 
        classifica, 
        mieiVoti, 
        blocco: { isBlocked, unlockDate } 
    });

  } catch (error) {
    console.error("Errore GET /api/grazia:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/grazia/vota - Salva/Aggiorna le richieste di grazia dell'utente
router.post('/vota', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { voti } = req.body; // Array di nomi per cui si chiede la grazia

    if (!Array.isArray(voti)) {
        return res.status(400).json({ error: "Il formato dei voti non è valido." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controlla il blocco settimanale
        const userResult = await client.query('SELECT "lastGraziaEdit" FROM utenti WHERE id = $1;', [userId]);
        const lastEdit = userResult.rows[0]?.lastGraziaEdit;
        if (lastEdit) {
            const now = new Date();
            const diff = now.getTime() - new Date(lastEdit).getTime();
            if (diff < (7 * 24 * 60 * 60 * 1000)) {
                throw new Error("Puoi modificare le richieste solo una volta a settimana.");
            }
        }
        
        // 1. Cancella tutte le richieste di grazia precedenti dell'utente
        await client.query('DELETE FROM voti_grazia WHERE user_id = $1', [userId]);

        // 2. Inserisce le nuove richieste
        if (voti.length > 0) {
            const insertQuery = 'INSERT INTO voti_grazia (user_id, nome) VALUES ' + 
                                voti.map((_, i) => `($1, $${i + 2})`).join(',');
            await client.query(insertQuery, [userId, ...voti]);
        }

        // 3. Aggiorna il timestamp dell'ultima modifica
        await client.query('UPDATE utenti SET "lastGraziaEdit" = NOW() WHERE id = $1', [userId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Richieste di grazia salvate." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/grazia/vota:", error);
        res.status(500).json({ error: error.message || "Errore del server" });
    } finally {
        client.release();
    }
});

module.exports = router;