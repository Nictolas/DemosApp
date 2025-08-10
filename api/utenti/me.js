// File: api/utenti/me.js
const { pool } = require('../../db'); // Adatta il percorso al tuo file db.js
const { authenticateUser } = require('../../middleware/auth'); // Adatta il percorso

module.exports = async (req, res) => {
    await authenticateUser(req, res, async () => {
        const userId = req.user.uid;
        try {
            const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Utente non trovato nel database." });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error("Errore /api/utenti/me:", error);
            res.status(500).json({ error: "Errore del server" });
        }
    });
};