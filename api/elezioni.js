// File: api/elezioni.js

const express = require('express');
const router = express.Router();
const { pool } = require('../db'); // Assicurati che il percorso sia corretto
const { authenticateUser } = require('../middleware/auth'); // Assicurati che il percorso sia corretto

// GET /api/elezioni - Recupera tutte le elezioni
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM elezioni ORDER BY "dataInizio" DESC');
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/elezioni:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/elezioni - Crea una nuova elezione
router.post('/', authenticateUser, async (req, res) => {
  // Aggiungi un controllo per assicurarti che solo un Admin possa creare
  // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });

  const { tipo, zona, dataInizio, dataFine, circa } = req.body;
  if (!tipo || !zona || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
  }

  try {
    const query = `
      INSERT INTO elezioni (tipo, zona, "dataInizio", "dataFine", circa)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [tipo, zona, dataInizio, dataFine, circa]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore POST /api/elezioni:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// PUT /api/elezioni/:id - Modifica un'elezione esistente
router.put('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { tipo, zona, dataInizio, dataFine, circa } = req.body;
  if (!tipo || !zona || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
  }
  try {
    const query = `
      UPDATE elezioni
      SET tipo = $1, zona = $2, "dataInizio" = $3, "dataFine" = $4, circa = $5
      WHERE id = $6
      RETURNING *;
    `;
    const result = await pool.query(query, [tipo, zona, dataInizio, dataFine, circa, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Elezione non trovata." });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Errore PUT /api/elezioni/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// DELETE /api/elezioni/:id - Elimina un'elezione
router.delete('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM elezioni WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Elezione non trovata." });
    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error(`Errore DELETE /api/elezioni/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

module.exports = router;