// File: api/utenti/register.js

const { pool } = require('../../db'); // Assicurati che il percorso al tuo file db.js sia corretto
const admin = require('firebase-admin'); // Assicurati che Firebase Admin sia inizializzato

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

// Esporta la funzione serverless
module.exports = async (req, res) => {
  // Vercel gestisce solo metodi specifici, controlliamo che sia POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Estrai tutti i dati inviati dal form di registrazione
  const { email, password, nome, cognome, data_nascita, genere, cittadinanza, ruolo, ...altriDati } = req.body;

  if (!email || !password || !nome || !cognome || !ruolo) {
    return res.status(400).json({ error: "Dati essenziali mancanti per la registrazione." });
  }

  let newUserUid = null;
  const client = await pool.connect();

  try {
    // 1. Crea l'utente su Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: `${nome} ${cognome}`,
      disabled: true, // L'utente è disabilitato finché un admin non lo approva
    });
    
    newUserUid = userRecord.uid;

    // 2. Prepara tutti i campi per l'inserimento nel database PostgreSQL
    const allUserData = {
      id: newUserUid,
      email,
      nome,
      cognome,
      data_nascita,
      genere,
      cittadinanza,
      ruolo,
      status: 'pending', // Lo stato iniziale è sempre 'pending'
      data_registrazione: new Date(),
      ...altriDati
    };
    
    const columns = Object.keys(allUserData).map(key => `"${key}"`).join(', ');
    const values = Object.values(allUserData);
    const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const insertQuery = `INSERT INTO utenti (${columns}) VALUES (${valuePlaceholders}) RETURNING *;`;
    
    // 3. Salva i dati nel DB
    await client.query('BEGIN');
    const dbResult = await client.query(insertQuery, values);
    await client.query('COMMIT');

    res.status(201).json(dbResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Errore durante la registrazione:", error);
    if (newUserUid) {
      try {
        await admin.auth().deleteUser(newUserUid);
        console.log(`Utente orfano ${newUserUid} cancellato da Firebase Auth.`);
      } catch (deleteError) {
        console.error(`Errore nel cancellare utente orfano ${newUserUid}:`, deleteError);
      }
    }
    res.status(500).json({ error: error.message || "Errore del server durante la registrazione." });
  } finally {
    client.release();
  }
};```