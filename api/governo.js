// File: api/governo.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/governo/voti - Recupera classifiche, voti utente e stato del blocco
router.get('/voti', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Query per ottenere tutti i voti
    const votiResult = await pool.query('SELECT categoria, "nomeMinistro" as nome, user_id FROM voti_ministri');
    const votiList = votiResult.rows;

    // Calcolo classifiche per ogni categoria
    const classifiche = {};
    const categorie = [...new Set(votiList.map(v => v.categoria))];
    categorie.forEach(cat => {
        const votiCat = votiList.filter(v => v.categoria === cat);
        const conteggio = {};
        votiCat.forEach(v => {
            conteggio[v.nome] = (conteggio[v.nome] || 0) + 1;
        });
        classifiche[cat] = Object.entries(conteggio)
            .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
            .sort((a, b) => b.voti - a.voti);
    });

    // Filtro per i voti specifici dell'utente
    const mieiVoti = {};
    votiList
        .filter(v => v.user_id === userId)
        .forEach(v => {
            mieiVoti[v.categoria] = v.nome;
        });
    
    // Controllo dello stato del blocco settimanale
    const userResult = await pool.query('SELECT "lastGovernoEdit" FROM utenti WHERE id = $1', [userId]);
    const lastEdit = userResult.rows[0]?.lastGovernoEdit;
    
    let isBlocked = false;
    let unlockDate = null;
    if (lastEdit) {
        const now = new Date();
        const diff = now.getTime() - new Date(lastEdit).getTime();
        if (diff < (7 * 24 * 60 * 60 * 1000)) {
            isBlocked = true;
            unlockDate = new Date(new Date(lastEdit).getTime() + (7 * 24 * 60 * 60 * 1000));
        }
    }

    res.json({ 
        classifiche, 
        mieiVoti, 
        blocco: { isBlocked, unlockDate } 
    });

  } catch (error) {
    console.error("Errore GET /api/governo/voti:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/governo/vota - Salva/Aggiorna le preferenze del governo dell'utente
router.post('/vota', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { voti } = req.body; // Oggetto { categoria: 'nome', ... }

    if (typeof voti !== 'object' || voti === null) {
        return res.status(400).json({ error: "Il formato dei voti non è valido." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controllo del blocco settimanale
        const userResult = await client.query('SELECT "lastGovernoEdit" FROM utenti WHERE id = $1', [userId]);
        const lastEdit = userResult.rows[0]?.lastGovernoEdit;
        if (lastEdit) {
            const now = new Date();
            const diff = now.getTime() - new Date(lastEdit).getTime();
            if (diff < (7 * 24 * 60 * 60 * 1000)) {
                throw new Error("Puoi modificare le preferenze solo una volta a settimana.");
            }
        }
        
        // 1. Cancella tutti i voti precedenti dell'utente per il governo
        await client.query('DELETE FROM voti_ministri WHERE user_id = $1', [userId]);

        // 2. Inserisce i nuovi voti
        const votiEntries = Object.entries(voti);
        if (votiEntries.length > 0) {
            const queryValues = [];
            const queryParams = [userId];
            votiEntries.forEach(([categoria, nomeMinistro]) => {
                queryParams.push(categoria, nomeMinistro);
                queryValues.push(`($1, $${queryParams.length-1}, $${queryParams.length})`);
            });
            
            const insertQuery = `INSERT INTO voti_ministri (user_id, categoria, "nomeMinistro") VALUES ${queryValues.join(',')}`;
            await client.query(insertQuery, queryParams);
        }

        // 3. Aggiorna il timestamp dell'ultima modifica
        await client.query('UPDATE utenti SET "lastGovernoEdit" = NOW() WHERE id = $1', [userId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Preferenze salvate." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/governo/vota:", error);
        res.status(500).json({ error: error.message || "Errore del server" });
    } finally {
        client.release();
    }
});

module.exports = router;