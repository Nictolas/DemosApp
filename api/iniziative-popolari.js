// File: api/iniziative-popolari.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/iniziative-popolari - Recupera tutte le iniziative approvate
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM iniziative_popolari WHERE stato = $1 ORDER BY "dataInizio" DESC', ['accepted']);
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/iniziative-popolari:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// GET /api/iniziative-popolari/richieste - Recupera le iniziative in attesa (solo Admin)
router.get('/richieste', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    try {
        const result = await pool.query('SELECT * FROM iniziative_popolari WHERE stato = $1 ORDER BY timestamp DESC', ['pending']);
        res.json(result.rows);
    } catch (error) {
        console.error("Errore GET /api/iniziative-popolari/richieste:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/iniziative-popolari - Propone una nuova iniziativa (stato 'pending')
router.post('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;

  if (!nome || !descrizione || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi obbligatori devono essere forniti." });
  }

  try {
    const query = `
      INSERT INTO iniziative_popolari (user_id, nome, descrizione, "dataInizio", "dataFine", "sitoWeb", stato, quorum)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
      RETURNING *;
    `;
    const result = await pool.query(query, [userId, nome, descrizione, dataInizio, dataFine, sitoWeb || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore POST /api/iniziative-popolari:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/iniziative-popolari/:id/accetta - Approva un'iniziativa (solo Admin)
router.post('/:id/accetta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE iniziative_popolari SET stato = $1 WHERE id = $2 RETURNING *', ['accepted', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/iniziative-popolari/${id}/accetta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/iniziative-popolari/:id/rifiuta - Rifiuta un'iniziativa (solo Admin)
router.post('/:id/rifiuta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE iniziative_popolari SET stato = $1 WHERE id = $2 RETURNING *', ['rejected', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/iniziative-popolari/${id}/rifiuta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// PATCH /api/iniziative-popolari/:id/quorum - Aggiorna lo stato del quorum (solo Admin)
router.patch('/:id/quorum', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    const { id } = req.params;
    const { quorum } = req.body;
    if (!['ok', 'pending', 'no'].includes(quorum)) {
        return res.status(400).json({ error: "Valore di quorum non valido." });
    }
    try {
        const result = await pool.query('UPDATE iniziative_popolari SET quorum = $1 WHERE id = $2 RETURNING *', [quorum, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Iniziativa non trovata." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore PATCH /api/iniziative-popolari/${id}/quorum:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// DELETE /api/iniziative-popolari/:id - Elimina un'iniziativa (solo Admin)
router.delete('/:id', authenticateUser, async (req, res) => {
  // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM iniziative_popolari WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Iniziativa non trovata." });
    res.status(204).send();
  } catch (error) {
    console.error(`Errore DELETE /api/iniziative-popolari/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

module.exports = router;