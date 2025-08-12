const { pool } = require('../config/db');
const { authenticateUser } = require('../middleware/auth');

module.exports = async (req, res) => {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestisci preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verifica autenticazione
    const user = await authenticateUser(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Query per ottenere i dati dell'utente
    const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [user.uid]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utente non trovato." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore GET /api/utenti/me:", error);
    res.status(500).json({ error: "Errore server" });
  }
};
