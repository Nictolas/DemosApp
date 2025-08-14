// API Server con Database Neon PostgreSQL
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Server Neon funzionante' });
});

// Test connessione
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Connessione database riuscita'
    });
  } catch (error) {
    console.error('Errore test connessione:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Utenti
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM utenti ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento utenti:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint auth con Neon (sostituzione Firebase)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e password sono richiesti'
      });
    }
    
    // Cerca l'utente nel database
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenziali non valide'
      });
    }
    
    const user = result.rows[0];
    
    // Per ora accettiamo qualsiasi password (in produzione usare bcrypt)
    // TODO: Implementare hash password con bcrypt
    
    // Genera un token semplice (in produzione usare JWT)
    const token = `token_${user.id}_${Date.now()}`;
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'user'
      },
      token,
      message: 'Login effettuato con successo'
    });
  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password e nome sono richiesti'
      });
    }
    
    // Verifica se l'utente esiste già
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Un utente con questa email esiste già'
      });
    }
    
    // Crea nuovo utente
    const result = await pool.query(
      'INSERT INTO users (email, name, email_verified, created_at) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
      [email.toLowerCase(), name, new Date(), new Date()]
    );
    
    const user = result.rows[0];
    
    // Genera token
    const token = `token_${user.id}_${Date.now()}`;
    
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'user'
      },
      token,
      message: 'Registrazione completata con successo'
    });
  } catch (error) {
    console.error('Errore registrazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    // Per ora non facciamo nulla lato server
    // In futuro potremmo invalidare i token in un database
    res.json({
      success: true,
      message: 'Logout effettuato'
    });
  } catch (error) {
    console.error('Errore logout:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint utenti (compatibilità)
app.post('/api/utenti/login', async (req, res) => {
  // Redirect al nuovo endpoint
  return res.redirect(307, '/api/auth/login');
});

app.get('/api/utenti/me', async (req, res) => {
  try {
    // Per il momento, verifichiamo se c'è un header di autorizzazione
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Token di autorizzazione mancante'
      });
    }
    
    // In un'implementazione completa, dovresti verificare il token Firebase
    // Per ora, cerchiamo l'utente admin per il test
    const result = await pool.query(
      'SELECT id, email, nome, cognome, ruolo FROM utenti WHERE email = $1',
      ['admin@admin.com']
    );
    
    if (result.rows.length === 0) {
      // Se non esiste, creiamo un utente admin di default
      const insertResult = await pool.query(
        'INSERT INTO utenti (email, nome, cognome, ruolo) VALUES ($1, $2, $3, $4) RETURNING id, email, nome, cognome, ruolo',
        ['admin@admin.com', 'Admin', 'User', 'admin']
      );
      
      return res.json({
        success: true,
        data: insertResult.rows[0]
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Errore recupero utente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

// API Opinioni
app.get('/api/opinions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento opinioni:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint opinioni (compatibilità)
app.get('/api/opinioni', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento opinioni:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint governo (placeholder)
app.get('/api/governo', async (req, res) => {
  try {
    res.json({
      success: true,
      data: [],
      message: 'Endpoint governo - da implementare'
    });
  } catch (error) {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint ministeri (placeholder)
app.get('/api/ministeri', async (req, res) => {
  try {
    res.json({
      success: true,
      data: [],
      message: 'Endpoint ministeri - da implementare'
    });
  } catch (error) {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Altri endpoint (placeholder per compatibilità)
const endpoints = [
  'sondaggi', 'elezioni', 'referendum', 'ice', 'iniziative-popolari',
  'grazia', 'amnistia', 'capo-stato', 'statistiche', 'sostenitori',
  'comunicazioni', 'notifiche', 'programma'
];

endpoints.forEach(endpoint => {
  app.get(`/api/${endpoint}`, async (req, res) => {
    try {
      res.json({
        success: true,
        data: [],
        message: `Endpoint ${endpoint} - da implementare con Neon`
      });
    } catch (error) {
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });
});

// Gestione route non trovate
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Rota non trovata', 
    path: req.originalUrl 
  });
});

// Avvio server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log('🚀 Server API database avviato sulla porta', port);
  console.log('📊 Database Neon connesso');
  console.log('🌐 API disponibile su: http://localhost:' + port + '/api');
});

module.exports = app;