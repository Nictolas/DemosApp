// API Server con Database Neon PostgreSQL
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// JWT Secret (in produzione usare una variabile d'ambiente sicura)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware per verificare JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token di accesso richiesto'
    });
  }
  
  const token = authHeader.substring(7); // Rimuove "Bearer "
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token non valido'
    });
  }
};

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
    
    // Cerca l'utente nel database (includo password_hash per la verifica)
    const result = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Email o password non corretti'
      });
    }
    
    const user = result.rows[0];
    
    // Verifica la password con bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Email o password non corretti'
      });
    }
    
    // Genera JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Rimuovi la password_hash dalla risposta
    const { password_hash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: {
        ...userWithoutPassword,
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
    
    // Hash della password con bcrypt
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Crea nuovo utente
    const result = await pool.query(
      'INSERT INTO users (email, name, password_hash, email_verified, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name',
      [email.toLowerCase(), name, passwordHash, new Date(), new Date()]
    );
    
    const user = result.rows[0];
    
    // Genera JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
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

app.get('/api/utenti/me', verifyToken, async (req, res) => {
  try {
    // Il middleware verifyToken ha già verificato il token e impostato req.user
    const userId = req.user.userId;
    
    // Cerca l'utente nel database
    const result = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        ...user,
        role: 'user' // Default role
      }
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