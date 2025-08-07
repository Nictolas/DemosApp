// File: api/ice.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); 
const { authenticateUser } = require('../middleware/auth');

// GET /api/ice - Recupera tutte le ICE approvate
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ice WHERE stato = $1 ORDER BY "dataInizio" DESC', ['accepted']);
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/ice:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// GET /api/ice/richieste - Recupera le ICE in attesa di approvazione (solo per Admin)
router.get('/richieste', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    try {
        const result = await pool.query('SELECT * FROM ice WHERE stato = $1 ORDER BY timestamp DESC', ['pending']);
        res.json(result.rows);
    } catch (error) {
        console.error("Errore GET /api/ice/richieste:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/ice - Propone una nuova ICE (stato 'pending')
router.post('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;

  if (!nome || !descrizione || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi obbligatori devono essere forniti." });
  }

  try {
    const query = `
      INSERT INTO ice (user_id, nome, descrizione, "dataInizio", "dataFine", "sitoWeb", stato, quorum)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
      RETURNING *;
    `;
    const result = await pool.query(query, [userId, nome, descrizione, dataInizio, dataFine, sitoWeb || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore POST /api/ice:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/ice/:id/accetta - Approva una ICE (solo Admin)
router.post('/:id/accetta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE ice SET stato = $1 WHERE id = $2 RETURNING *', ['accepted', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/ice/${id}/accetta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/ice/:id/rifiuta - Rifiuta una ICE (solo Admin)
router.post('/:id/rifiuta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        // Invece di cancellare, potremmo voler marcare come 'rejected'
        const result = await pool.query('UPDATE ice SET stato = $1 WHERE id = $2 RETURNING *', ['rejected', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/ice/${id}/rifiuta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// PATCH /api/ice/:id/quorum - Aggiorna lo stato del quorum (solo Admin)
router.patch('/:id/quorum', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    const { id } = req.params;
    const { quorum } = req.body;
    if (!['ok', 'pending', 'no'].includes(quorum)) {
        return res.status(400).json({ error: "Valore di quorum non valido." });
    }
    try {
        const result = await pool.query('UPDATE ice SET quorum = $1 WHERE id = $2 RETURNING *', [quorum, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "ICE non trovata." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore PATCH /api/ice/${id}/quorum:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// DELETE /api/ice/:id - Elimina una ICE (solo Admin)
router.delete('/:id', authenticateUser, async (req, res) => {
  // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM ice WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "ICE non trovata." });
    res.status(204).send();
  } catch (error) {
    console.error(`Errore DELETE /api/ice/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

module.exports = router;