// API endpoint principale per Vercel
// Questo file viene riconosciuto automaticamente da Vercel come /api

const express = require('express');
const cors = require('cors');
const { pool } = require('./api/config/db');
const { authenticateUser } = require('./api/middleware/auth');
const admin = require('firebase-admin');

// Inizializza Firebase Admin SDK
if (admin.apps.length === 0) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin SDK inizializzato con successo.');
    } else {
      console.warn('Credenziali Firebase Admin non trovate.');
    }
  } catch (error) {
    console.error('ERRORE CRITICO: Impossibile inizializzare Firebase Admin SDK.', error);
  }
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API funzionante' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint funzionante' });
});

// Endpoint utenti
app.get('/api/utenti/me', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utente non trovato" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore GET /api/utenti/me:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// Gestione errori
app.use((err, req, res, next) => {
  console.error('Errore API:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

// Gestione route non trovate
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trovata' });
});

module.exports = app;
