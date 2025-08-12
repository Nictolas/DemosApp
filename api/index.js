// API completa per DEMOS
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configurazione database
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API funzionante' });
});

// Endpoint utenti
app.post('/api/utenti/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Query per verificare le credenziali
    const query = 'SELECT * FROM utenti WHERE email = $1 AND password = $2';
    const result = await pool.query(query, [email, password]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          email: user.email, 
          nome: user.nome,
          cognome: user.cognome 
        } 
      });
    } else {
      res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }
  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({ success: false, message: 'Errore interno del server' });
  }
});

app.get('/api/utenti/me', (req, res) => {
  res.json({ message: 'Endpoint utenti funzionante', user: 'test' });
});

// Endpoint governo
app.get('/api/governo', async (req, res) => {
  try {
    const query = 'SELECT * FROM governo ORDER BY id DESC LIMIT 1';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore governo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint ministeri
app.get('/api/ministeri', async (req, res) => {
  try {
    const query = 'SELECT * FROM ministeri ORDER BY nome';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore ministeri:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint opinioni
app.get('/api/opinioni', async (req, res) => {
  try {
    const query = 'SELECT * FROM opinioni ORDER BY data_creazione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore opinioni:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint sondaggi
app.get('/api/sondaggi', async (req, res) => {
  try {
    const query = 'SELECT * FROM sondaggi ORDER BY data_scadenza DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore sondaggi:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint elezioni
app.get('/api/elezioni', async (req, res) => {
  try {
    const query = 'SELECT * FROM elezioni ORDER BY data_elezione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore elezioni:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint referendum
app.get('/api/referendum', async (req, res) => {
  try {
    const query = 'SELECT * FROM referendum_abrogativi ORDER BY data_scadenza DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore referendum:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint ICE
app.get('/api/ice', async (req, res) => {
  try {
    const query = 'SELECT * FROM ice ORDER BY data_creazione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore ICE:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint iniziative popolari
app.get('/api/iniziative-popolari', async (req, res) => {
  try {
    const query = 'SELECT * FROM iniziative_popolari ORDER BY data_creazione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore iniziative popolari:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint grazia
app.get('/api/grazia', async (req, res) => {
  try {
    const query = 'SELECT * FROM grazia ORDER BY data_richiesta DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore grazia:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint amnistia
app.get('/api/amnistia', async (req, res) => {
  try {
    const query = 'SELECT * FROM amnistia ORDER BY data_richiesta DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore amnistia:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint capo di stato
app.get('/api/capo-stato', async (req, res) => {
  try {
    const query = 'SELECT * FROM capo_stato ORDER BY data_elezione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore capo di stato:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint statistiche
app.get('/api/statistiche', async (req, res) => {
  try {
    const query = 'SELECT COUNT(*) as totale_utenti FROM utenti';
    const result = await pool.query(query);
    res.json({ 
      totale_utenti: result.rows[0].totale_utenti,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Errore statistiche:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint sostenitori
app.get('/api/sostenitori', async (req, res) => {
  try {
    const query = 'SELECT * FROM sostenitori ORDER BY data_adesione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore sostenitori:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint comunicazioni
app.get('/api/comunicazioni', async (req, res) => {
  try {
    const query = 'SELECT * FROM comunicazioni ORDER BY data_invio DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore comunicazioni:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint notifiche
app.get('/api/notifiche', async (req, res) => {
  try {
    const query = 'SELECT * FROM notifiche ORDER BY data_creazione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore notifiche:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint programma
app.get('/api/programma', async (req, res) => {
  try {
    const query = 'SELECT * FROM programma ORDER BY data_creazione DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore programma:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Gestione route non trovate
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trovata', path: req.originalUrl });
});

module.exports = app;