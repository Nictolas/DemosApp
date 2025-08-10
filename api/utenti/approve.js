// File: api/utenti/approve.js

const { pool } = require('../../db'); // Adatta il percorso al tuo file db.js
const { authenticateUser } = require('../../middleware/auth'); // Adatta il percorso
const admin = require('firebase-admin');

// Inizializza Firebase Admin se non è già stato fatto
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error', error.stack);
  }
}

// Esporta la funzione serverless, protetta da autenticazione
module.exports = async (req, res) => {
  await authenticateUser(req, res, async () => {
    // Controlla che l'utente che fa la richiesta sia un Admin
    // if (req.user.role !== 'Admin') {
    //    return res.status(403).json({ error: "Accesso negato. Solo gli admin possono approvare utenti." });
    // }

    // Controlla che il metodo sia POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "L'ID dell'utente è obbligatorio." });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. Aggiorna lo stato nel database PostgreSQL
      const dbResult = await client.query("UPDATE utenti SET status = 'active' WHERE id = $1", [userId]);

      if (dbResult.rowCount === 0) {
        throw new Error("Utente non trovato nel database.");
      }

      // 2. Abilita l'utente su Firebase Authentication
      await admin.auth().updateUser(userId, { disabled: false });
      
      await client.query('COMMIT');
      res.status(200).json({ success: true, message: 'Utente approvato con successo.' });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Errore durante l'approvazione dell'utente:", error);
      res.status(500).json({ error: error.message || "Errore del server durante l'approvazione." });
    } finally {
      client.release();
    }
  });
};