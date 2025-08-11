// File: api/utenti/me.js
const { pool } = require('../../db');
const { authenticateUser } = require('../../middleware/auth');

async function handler(req, res) {
  const userId = req.user.uid;
  console.log(`[Handler /me] Esecuzione per utente: ${userId}`);
  
  try {
    const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      console.log(`[Handler /me] Utente ${userId} non trovato nel DB.`);
      return res.status(404).json({ error: "Utente non trovato nel database." });
    }
    console.log(`[Handler /me] Utente ${userId} trovato.`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`[Handler /me] Errore DB:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
}

// Esporta la funzione avvolta nel middleware
module.exports = authenticateUser(handler);